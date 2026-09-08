using CreatorPay.Application.Common;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Domain.Ugc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Ugc.Services;

public interface IUgcCampaignService
{
    Task<Result<UgcCampaignDto>> CreateAsync(Guid brandUserId, UpsertUgcCampaignRequest request, CancellationToken ct = default);
    Task<Result<UgcCampaignDto>> UpdateAsync(Guid brandUserId, Guid id, UpsertUgcCampaignRequest request, CancellationToken ct = default);
    Task<Result<UgcCampaignDto>> PublishAsync(Guid brandUserId, Guid id, CancellationToken ct = default);
    Task<Result<UgcCampaignDto>> CloseAsync(Guid brandUserId, Guid id, CancellationToken ct = default);
    Task<Result<bool>> DeleteAsync(Guid brandUserId, Guid id, CancellationToken ct = default);
    Task<Result<List<UgcCampaignDto>>> ListMineAsync(Guid brandUserId, string? status, CancellationToken ct = default);
    Task<Result<UgcCampaignDto>> GetAsync(Guid userId, Guid id, CancellationToken ct = default);
    Task<Result<UgcBriefDto>> GenerateBriefAsync(Guid brandUserId, GenerateUgcBriefRequest request, CancellationToken ct = default);
    Task<Result<List<UgcCampaignDto>>> ListForCreatorAsync(Guid creatorUserId, bool onlyMatching, CancellationToken ct = default);
}

/// <summary>Brand-side campaign lifecycle and the creator's window onto published ones.</summary>
public sealed class UgcCampaignService : IUgcCampaignService
{
    public const long MinPaidBudgetOre = 5_000;          // 50 kr per video — below that it is not a job

    private readonly IRepository<UgcCampaign> _campaigns;
    private readonly IRepository<UgcApplication> _applications;
    private readonly IRepository<UgcCollab> _collabs;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<UgcCreatorProfile> _ugcCreators;
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notify;
    private readonly IUgcBriefGenerator _brief;
    private readonly ILogger<UgcCampaignService> _logger;

    public UgcCampaignService(IRepository<UgcCampaign> campaigns, IRepository<UgcApplication> applications, IRepository<UgcCollab> collabs,
        IRepository<BrandProfile> brands, IRepository<CreatorProfile> creators, IRepository<UgcCreatorProfile> ugcCreators,
        IUnitOfWork uow, INotificationService notify, IUgcBriefGenerator brief, ILogger<UgcCampaignService> logger)
    {
        _campaigns = campaigns; _applications = applications; _collabs = collabs; _brands = brands; _creators = creators;
        _ugcCreators = ugcCreators; _uow = uow; _notify = notify; _brief = brief; _logger = logger;
    }

    // ── Brand ──────────────────────────────────────────────────────

    public async Task<Result<UgcCampaignDto>> CreateAsync(Guid brandUserId, UpsertUgcCampaignRequest r, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        var (err, comp, rights) = Validate(r);
        if (err != null) return Errors.Validation(err);

        var c = new UgcCampaign { BrandProfileId = brand.Id };
        Apply(c, r, comp, rights);
        _campaigns.Add(c);
        await _uow.SaveChangesAsync(ct);
        return UgcMapper.Campaign(c, brand.CompanyName, brand.LogoUrl, 0, 0, 0);
    }

    public async Task<Result<UgcCampaignDto>> UpdateAsync(Guid brandUserId, Guid id, UpsertUgcCampaignRequest r, CancellationToken ct = default)
    {
        var (brand, c, fail) = await OwnedAsync(brandUserId, id, ct);
        if (fail != null) return fail;
        if (c!.Status != UgcCampaignStatus.Draft)
            return Errors.Conflict("Bara utkast kan redigeras. Stäng kampanjen och skapa en ny om briefen måste ändras — ingångna avtal bygger på den gamla.");
        var (err, comp, rights) = Validate(r);
        if (err != null) return Errors.Validation(err);

        Apply(c, r, comp, rights);
        await _uow.SaveChangesAsync(ct);
        return await MapAsync(c, brand!, ct);
    }

    public async Task<Result<UgcCampaignDto>> PublishAsync(Guid brandUserId, Guid id, CancellationToken ct = default)
    {
        var (brand, c, fail) = await OwnedAsync(brandUserId, id, ct);
        if (fail != null) return fail;
        if (brand!.Status != BrandStatus.Approved) return Errors.Forbidden("Företagskontot måste vara godkänt innan ni kan beställa.");

        var check = UgcCampaignStateMachine.Check(c!.Status, UgcCampaignStatus.Published, UgcActor.Brand, !string.IsNullOrWhiteSpace(brand.OrganizationNumber));
        if (!check.Allowed) return Errors.Conflict(check.Reason!);
        UgcCampaignStateMachine.Apply(c, UgcCampaignStatus.Published, UgcActor.Brand, DateTime.UtcNow, true);
        await _uow.SaveChangesAsync(ct);

        var matched = await NotifyMatchingCreatorsAsync(c, brand, ct);
        _logger.LogInformation("UGC campaign {Id} published, {Matched} creators notified", c.Id, matched);
        return await MapAsync(c, brand, ct);
    }

    public async Task<Result<UgcCampaignDto>> CloseAsync(Guid brandUserId, Guid id, CancellationToken ct = default)
    {
        var (brand, c, fail) = await OwnedAsync(brandUserId, id, ct);
        if (fail != null) return fail;
        var check = UgcCampaignStateMachine.Check(c!.Status, UgcCampaignStatus.Closed, UgcActor.Brand, true);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);
        var now = DateTime.UtcNow;
        UgcCampaignStateMachine.Apply(c, UgcCampaignStatus.Closed, UgcActor.Brand, now, true);

        // Open bids are answered, not left hanging.
        var open = await _applications.Query().Include(a => a.CreatorProfile)
            .Where(a => a.CampaignId == c.Id && (a.Status == UgcApplicationStatus.Applied || a.Status == UgcApplicationStatus.Preselected))
            .ToListAsync(ct);
        foreach (var a in open)
        {
            UgcApplicationStateMachine.Apply(a, UgcApplicationStatus.Rejected, UgcActor.System, now, "Kampanjen stängdes.");
            await Notify(a.CreatorProfile.UserId, NotificationType.UgcCancelled, $"Kampanjen \"{c.Title}\" stängdes innan din ansökan hanterades.", c.Id);
        }
        await _uow.SaveChangesAsync(ct);
        return await MapAsync(c, brand!, ct);
    }

    public async Task<Result<bool>> DeleteAsync(Guid brandUserId, Guid id, CancellationToken ct = default)
    {
        var (_, c, fail) = await OwnedAsync(brandUserId, id, ct);
        if (fail != null) return fail.Error!;
        if (c!.Status != UgcCampaignStatus.Draft) return Errors.Conflict("Bara utkast kan tas bort — stäng kampanjen i stället.");
        c.IsDeleted = true;
        await _uow.SaveChangesAsync(ct);
        return true;
    }

    public async Task<Result<List<UgcCampaignDto>>> ListMineAsync(Guid brandUserId, string? status, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        var q = _campaigns.Query().Where(c => c.BrandProfileId == brand.Id);
        if (Enum.TryParse<UgcCampaignStatus>(status, true, out var s)) q = q.Where(c => c.Status == s);
        var list = await q.OrderByDescending(c => c.CreatedAt).ToListAsync(ct);
        var result = new List<UgcCampaignDto>(list.Count);
        foreach (var c in list) result.Add(await MapAsync(c, brand, ct));
        return result;
    }

    public async Task<Result<UgcCampaignDto>> GetAsync(Guid userId, Guid id, CancellationToken ct = default)
    {
        var c = await _campaigns.Query().Include(x => x.BrandProfile).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c == null) return Errors.NotFound("Campaign", id);
        if (c.BrandProfile.UserId == userId) return await MapAsync(c, c.BrandProfile, ct);

        // A creator sees published (or closed, if they took part) campaigns only.
        var creator = await _creators.Query().FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (creator == null) return Errors.Forbidden("Ingen åtkomst.");
        var mine = await _applications.Query().FirstOrDefaultAsync(a => a.CampaignId == id && a.CreatorProfileId == creator.Id, ct);
        if (c.Status == UgcCampaignStatus.Draft || (c.Status == UgcCampaignStatus.Closed && mine == null))
            return Errors.NotFound("Campaign", id);
        var myCollab = mine == null ? null : await _collabs.Query().Where(x => x.ApplicationId == mine.Id).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        return await MapAsync(c, c.BrandProfile, ct, mine, myCollab);
    }

    public async Task<Result<UgcBriefDto>> GenerateBriefAsync(Guid brandUserId, GenerateUgcBriefRequest r, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        if (!_brief.IsConfigured) return Errors.Conflict("AI-brief är inte aktiverad ännu — skriv briefen själv så länge.");
        try
        {
            return await _brief.GenerateAsync(new UgcBriefContext(
                brand.CompanyName, brand.Industry, brand.Description, brand.Website,
                r.Goal, r.ProductOrService, r.Audience, r.Tone, r.Extra), ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "UGC AI brief failed for brand {Id}", brand.Id);
            return Errors.Conflict("AI:n kunde inte skriva briefen just nu. Försök igen om en stund.");
        }
    }

    // ── Creator ────────────────────────────────────────────────────

    public async Task<Result<List<UgcCampaignDto>>> ListForCreatorAsync(Guid creatorUserId, bool onlyMatching, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var me = await _ugcCreators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == creator.Id, ct);

        var published = await _campaigns.Query().Include(c => c.BrandProfile)
            .Where(c => c.Status == UgcCampaignStatus.Published)
            .OrderByDescending(c => c.PublishedAt).ToListAsync(ct);
        var mine = await _applications.Query().Where(a => a.CreatorProfileId == creator.Id).ToListAsync(ct);
        var myApps = mine.ToDictionary(a => a.CampaignId);
        var myCollabs = await _collabs.Query().Where(x => x.CreatorProfileId == creator.Id && x.CampaignId != null)
            .Select(x => new { x.CampaignId, x.Id }).ToListAsync(ct);
        var collabByCampaign = myCollabs.GroupBy(x => x.CampaignId!.Value).ToDictionary(g => g.Key, g => g.First().Id);

        var result = new List<UgcCampaignDto>();
        foreach (var c in published)
        {
            if (onlyMatching && me != null && !Matches(c, me, creator)) continue;
            var dto = await MapAsync(c, c.BrandProfile, ct, myApps.GetValueOrDefault(c.Id), collabByCampaign.TryGetValue(c.Id, out var cid) ? cid : null);
            if (dto.HiredCount >= dto.Slots && dto.MyApplicationStatus == null) continue;   // full, and not mine
            result.Add(dto);
        }
        return result;
    }

    // ── Internals ──────────────────────────────────────────────────

    private async Task<(BrandProfile?, UgcCampaign?, Result<UgcCampaignDto>?)> OwnedAsync(Guid brandUserId, Guid id, CancellationToken ct)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return (null, null, Errors.NotFound("Brand"));
        var c = await _campaigns.Query().FirstOrDefaultAsync(x => x.Id == id && x.BrandProfileId == brand.Id, ct);
        if (c == null) return (brand, null, Errors.NotFound("Campaign", id));
        return (brand, c, null);
    }

    private async Task<UgcCampaignDto> MapAsync(UgcCampaign c, BrandProfile brand, CancellationToken ct, UgcApplication? mine = null, Guid? myCollab = null)
    {
        var hired = await _collabs.Query().CountAsync(x => x.CampaignId == c.Id && x.Status != UgcCollabStatus.Cancelled, ct);
        var apps = await _applications.Query().Where(a => a.CampaignId == c.Id).GroupBy(a => 1)
            .Select(g => new { Total = g.Count(), Pending = g.Count(a => a.Status == UgcApplicationStatus.Applied || a.Status == UgcApplicationStatus.Preselected) })
            .FirstOrDefaultAsync(ct);
        return UgcMapper.Campaign(c, brand.CompanyName, brand.LogoUrl, hired, apps?.Total ?? 0, apps?.Pending ?? 0, mine, myCollab);
    }

    internal static bool Matches(UgcCampaign c, UgcCreatorProfile me, CreatorProfile creator)
    {
        if (c.Categories.Length > 0)
        {
            var mine = me.Categories.Concat([creator.Category]).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.ToLowerInvariant()).ToHashSet();
            if (!c.Categories.Any(x => mine.Contains(x.ToLowerInvariant()))) return false;
        }
        if (!string.IsNullOrWhiteSpace(c.Region) && !string.Equals(c.Region, me.Region, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(c.Region, me.City, StringComparison.OrdinalIgnoreCase)) return false;
        var followers = Math.Max(me.FollowerSnapshot, creator.FollowerCount);
        if (c.MinFollowers is { } min && followers < min) return false;
        if (c.MaxFollowers is { } max && followers > max) return false;
        return true;
    }

    private async Task<int> NotifyMatchingCreatorsAsync(UgcCampaign c, BrandProfile brand, CancellationToken ct)
    {
        var eligible = await _ugcCreators.Query().Include(p => p.CreatorProfile)
            .Where(p => p.Status == UgcCreatorStatus.Verified || p.Status == UgcCreatorStatus.Approved)
            .Take(2000).ToListAsync(ct);
        var n = 0;
        foreach (var p in eligible)
        {
            if (!Matches(c, p, p.CreatorProfile)) continue;
            await Notify(p.CreatorProfile.UserId, NotificationType.UgcCampaignMatch,
                $"{brand.CompanyName} söker creators: \"{c.Title}\" — {Describe(c)}. Lägg ditt bud i Videouppdrag.", c.Id);
            n++;
            if (n >= 500) break;
        }
        return n;
    }

    private static string Describe(UgcCampaign c) => c.Compensation switch
    {
        UgcCompensationType.ProductExchange => "produktbyte",
        _ => $"{UgcFeeCalculator.FormatSek(c.BudgetMinOre)}–{UgcFeeCalculator.FormatSek(c.BudgetMaxOre)} per video",
    };

    private async Task Notify(Guid userId, NotificationType type, string message, Guid refId)
    {
        try { await _notify.SendAsync(userId, type, message, refId); }
        catch (Exception ex) { _logger.LogWarning(ex, "UGC notification failed for {User}", userId); }
    }

    private static (string? Error, UgcCompensationType Comp, UgcRightsPackage Rights) Validate(UpsertUgcCampaignRequest r)
    {
        if (!Enum.TryParse<UgcCompensationType>(r.Compensation, true, out var comp)) return ("Okänd ersättningstyp.", default, default);
        if (!Enum.TryParse<UgcRightsPackage>(r.RightsPackage, true, out var rights)) return ("Okänt rättighetspaket.", default, default);
        if (string.IsNullOrWhiteSpace(r.Title) || r.Title.Trim().Length < 3 || r.Title.Length > 200) return ("Ge kampanjen en titel (3–200 tecken).", comp, rights);
        var b = r.Brief;
        if (b == null) return ("Briefen saknas.", comp, rights);
        if (string.IsNullOrWhiteSpace(b.Goal)) return ("Briefen behöver ett mål.", comp, rights);
        if (string.IsNullOrWhiteSpace(b.Format)) return ("Briefen behöver ett format (t.ex. 9:16 TikTok).", comp, rights);
        if (string.IsNullOrWhiteSpace(b.CallToAction)) return ("Briefen behöver en call to action.", comp, rights);
        if (b.LengthSeconds is < 5 or > 180) return ("Videolängd 5–180 sekunder.", comp, rights);
        if (b.VideoCount is < 1 or > 10) return ("1–10 videor per creator.", comp, rights);
        if (r.DeadlineDays is < 1 or > 60) return ("Leveranstid 1–60 dagar.", comp, rights);
        if (r.Slots is < 1 or > 50) return ("1–50 creators.", comp, rights);
        if (comp == UgcCompensationType.ProductExchange)
        {
            if (string.IsNullOrWhiteSpace(r.ProductDescription)) return ("Beskriv produkten creatorn får.", comp, rights);
        }
        else
        {
            if (r.BudgetMinOre < MinPaidBudgetOre) return ($"Lägsta budget per video är {UgcFeeCalculator.FormatSek(MinPaidBudgetOre)}.", comp, rights);
            if (r.BudgetMaxOre < r.BudgetMinOre) return ("Max-budget kan inte vara lägre än min-budget.", comp, rights);
            if (r.BudgetMaxOre > 100_000_00) return ("Max-budget per video är 100 000 kr.", comp, rights);
            if (comp == UgcCompensationType.PaidPlusProduct && string.IsNullOrWhiteSpace(r.ProductDescription)) return ("Beskriv produkten som ingår.", comp, rights);
        }
        if (r.MinFollowers is < 0 || r.MaxFollowers is < 0) return ("Följarintervall kan inte vara negativt.", comp, rights);
        if (r.MinFollowers is { } mn && r.MaxFollowers is { } mx && mx < mn) return ("Max följare kan inte vara lägre än min.", comp, rights);
        return (null, comp, rights);
    }

    private static void Apply(UgcCampaign c, UpsertUgcCampaignRequest r, UgcCompensationType comp, UgcRightsPackage rights)
    {
        c.Title = r.Title.Trim();
        UgcMapper.ApplyBrief(c, r.Brief);
        c.BriefGeneratedByAi = r.BriefGeneratedByAi;
        c.Region = string.IsNullOrWhiteSpace(r.Region) ? null : r.Region.Trim();
        c.Categories = UgcMapper.Clean(r.Categories);
        c.MinFollowers = r.MinFollowers;
        c.MaxFollowers = r.MaxFollowers;
        c.Compensation = comp;
        c.BudgetMinOre = comp == UgcCompensationType.ProductExchange ? 0 : r.BudgetMinOre;
        c.BudgetMaxOre = comp == UgcCompensationType.ProductExchange ? 0 : r.BudgetMaxOre;
        c.ProductDescription = string.IsNullOrWhiteSpace(r.ProductDescription) ? null : r.ProductDescription.Trim();
        c.ProductValueOre = r.ProductValueOre is > 0 ? r.ProductValueOre : null;
        c.RightsPackage = rights;
        c.DeadlineDays = r.DeadlineDays;
        c.Slots = r.Slots;
    }
}
