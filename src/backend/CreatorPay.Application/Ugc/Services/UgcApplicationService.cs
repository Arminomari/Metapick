using CreatorPay.Application.Common;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Domain.Ugc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Ugc.Services;

public interface IUgcApplicationService
{
    Task<Result<UgcApplicationDto>> ApplyAsync(Guid creatorUserId, Guid campaignId, ApplyToUgcCampaignRequest request, CancellationToken ct = default);
    Task<Result<bool>> WithdrawAsync(Guid creatorUserId, Guid applicationId, CancellationToken ct = default);
    Task<Result<List<UgcApplicationDto>>> ListMineAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<List<UgcApplicationDto>>> ListForCampaignAsync(Guid brandUserId, Guid campaignId, CancellationToken ct = default);
    Task<Result<UgcApplicationDto>> PreselectAsync(Guid brandUserId, Guid applicationId, CancellationToken ct = default);
    Task<Result<UgcApplicationDto>> RejectAsync(Guid brandUserId, Guid applicationId, DecideUgcApplicationRequest request, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> HireAsync(Guid brandUserId, Guid applicationId, CancellationToken ct = default);
}

/// <summary>
/// Bids on published campaigns. Creators apply with a price inside the
/// brand's range and a pitch; the brand sees them ranked by track record and
/// fit, preselects, and hires — which hands over to the collab service.
/// </summary>
public sealed class UgcApplicationService : IUgcApplicationService
{
    private readonly IRepository<UgcApplication> _applications;
    private readonly IRepository<UgcCampaign> _campaigns;
    private readonly IRepository<UgcCollab> _collabs;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<UgcCreatorProfile> _ugcCreators;
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notify;
    private readonly IUgcCreatorService _creatorService;
    private readonly IUgcCollabService _collabService;
    private readonly UgcSettings _settings;
    private readonly ILogger<UgcApplicationService> _logger;

    public UgcApplicationService(IRepository<UgcApplication> applications, IRepository<UgcCampaign> campaigns, IRepository<UgcCollab> collabs,
        IRepository<BrandProfile> brands, IRepository<CreatorProfile> creators, IRepository<UgcCreatorProfile> ugcCreators,
        IUnitOfWork uow, INotificationService notify, IUgcCreatorService creatorService, IUgcCollabService collabService,
        UgcSettings settings, ILogger<UgcApplicationService> logger)
    {
        _applications = applications; _campaigns = campaigns; _collabs = collabs; _brands = brands; _creators = creators;
        _ugcCreators = ugcCreators; _uow = uow; _notify = notify; _creatorService = creatorService; _collabService = collabService;
        _settings = settings; _logger = logger;
    }

    public async Task<Result<UgcApplicationDto>> ApplyAsync(Guid creatorUserId, Guid campaignId, ApplyToUgcCampaignRequest r, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var me = await _creatorService.GetOrCreateAsync(creator.Id, ct);

        var campaign = await _campaigns.Query().Include(c => c.BrandProfile).FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        if (campaign == null || campaign.Status != UgcCampaignStatus.Published)
            return Errors.Conflict("Kampanjen tar inte emot ansökningar.");

        if (!UgcVerificationRule.CanApply(me.Status, campaign.Compensation, me.PayoutOnboardingComplete, me.HasFTax, _settings.RequireFTaxForPaid))
            return Errors.Forbidden(me.Status switch
            {
                UgcCreatorStatus.Suspended => "Ditt konto på marknadsplatsen är avstängt.",
                UgcCreatorStatus.Pending => "Din profil måste verifieras innan du kan lägga bud.",
                _ when !me.PayoutOnboardingComplete => "Slutför utbetalningsregistreringen innan du tar betalda uppdrag.",
                _ => "Betalda uppdrag kräver F-skatt.",
            });

        var pitch = (r.Pitch ?? "").Trim();
        if (pitch.Length < 20) return Errors.Validation("Skriv en pitch på minst 20 tecken — det är det första företaget läser.");
        if (pitch.Length > 2000) return Errors.Validation("Pitchen får vara högst 2000 tecken.");

        var bid = campaign.Compensation == UgcCompensationType.ProductExchange ? 0 : r.BidOre;
        if (campaign.Compensation != UgcCompensationType.ProductExchange && (bid < campaign.BudgetMinOre || bid > campaign.BudgetMaxOre))
            return Errors.Validation($"Budet måste ligga mellan {UgcFeeCalculator.FormatSek(campaign.BudgetMinOre)} och {UgcFeeCalculator.FormatSek(campaign.BudgetMaxOre)} per video.");

        if (await _applications.Query().AnyAsync(a => a.CampaignId == campaignId && a.CreatorProfileId == creator.Id, ct))
            return Errors.Conflict("Du har redan lagt ett bud på den här kampanjen.");
        var hired = await _collabs.Query().CountAsync(x => x.CampaignId == campaignId && x.Status != UgcCollabStatus.Cancelled, ct);
        if (hired >= campaign.Slots) return Errors.Conflict("Alla platser är redan tillsatta.");

        var app = new UgcApplication { CampaignId = campaignId, CreatorProfileId = creator.Id, BidOre = bid, Pitch = pitch };
        _applications.Add(app);
        try { await _uow.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return Errors.Conflict("Du har redan lagt ett bud på den här kampanjen."); }

        await Notify(campaign.BrandProfile.UserId, NotificationType.UgcNewApplication,
            $"{creator.DisplayName} har lagt ett bud på \"{campaign.Title}\"" + (bid > 0 ? $": {UgcFeeCalculator.FormatSek(bid)} per video." : "."), campaign.Id);

        return UgcMapper.Application(app, campaign, creator, me, null);
    }

    public async Task<Result<bool>> WithdrawAsync(Guid creatorUserId, Guid applicationId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var app = await _applications.Query().FirstOrDefaultAsync(a => a.Id == applicationId && a.CreatorProfileId == creator.Id, ct);
        if (app == null) return Errors.NotFound("Application", applicationId);
        var check = UgcApplicationStateMachine.Check(app.Status, UgcApplicationStatus.Withdrawn, UgcActor.Creator);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);
        UgcApplicationStateMachine.Apply(app, UgcApplicationStatus.Withdrawn, UgcActor.Creator, DateTime.UtcNow);
        await _uow.SaveChangesAsync(ct);
        return true;
    }

    public async Task<Result<List<UgcApplicationDto>>> ListMineAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var me = await _ugcCreators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == creator.Id, ct);
        var apps = await _applications.Query().Include(a => a.Campaign)
            .Where(a => a.CreatorProfileId == creator.Id).OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        var collabs = await CollabsByApplicationAsync(apps.Select(a => a.Id).ToList(), ct);
        return apps.Select(a => UgcMapper.Application(a, a.Campaign, creator, me, collabs.GetValueOrDefault(a.Id))).ToList();
    }

    public async Task<Result<List<UgcApplicationDto>>> ListForCampaignAsync(Guid brandUserId, Guid campaignId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        var campaign = await _campaigns.Query().FirstOrDefaultAsync(c => c.Id == campaignId && c.BrandProfileId == brand.Id, ct);
        if (campaign == null) return Errors.NotFound("Campaign", campaignId);

        var apps = await _applications.Query().Include(a => a.CreatorProfile)
            .Where(a => a.CampaignId == campaignId).ToListAsync(ct);
        var ids = apps.Select(a => a.CreatorProfileId).ToList();
        var profiles = await _ugcCreators.Query().Where(p => ids.Contains(p.CreatorProfileId)).ToListAsync(ct);
        var byCreator = profiles.ToDictionary(p => p.CreatorProfileId);
        var collabs = await CollabsByApplicationAsync(apps.Select(a => a.Id).ToList(), ct);

        // Ranked: delivery record first, then fit (region), then engagement.
        return apps
            .Select(a => (App: a, Profile: byCreator.GetValueOrDefault(a.CreatorProfileId), Score: Score(a, byCreator.GetValueOrDefault(a.CreatorProfileId), campaign)))
            .OrderByDescending(x => x.App.Status == UgcApplicationStatus.Preselected)
            .ThenByDescending(x => x.Score)
            .ThenBy(x => x.App.CreatedAt)
            .Select(x => UgcMapper.Application(x.App, campaign, x.App.CreatorProfile, x.Profile, collabs.GetValueOrDefault(x.App.Id)))
            .ToList();
    }

    public async Task<Result<UgcApplicationDto>> PreselectAsync(Guid brandUserId, Guid applicationId, CancellationToken ct = default)
        => await DecideAsync(brandUserId, applicationId, UgcApplicationStatus.Preselected, null, ct);

    public async Task<Result<UgcApplicationDto>> RejectAsync(Guid brandUserId, Guid applicationId, DecideUgcApplicationRequest r, CancellationToken ct = default)
        => await DecideAsync(brandUserId, applicationId, UgcApplicationStatus.Rejected, r.Note, ct);

    public async Task<Result<UgcCollabDetailDto>> HireAsync(Guid brandUserId, Guid applicationId, CancellationToken ct = default)
    {
        var (brand, app, fail) = await OwnedAsync(brandUserId, applicationId, ct);
        if (fail != null) return fail.Error!;

        var check = UgcApplicationStateMachine.Check(app!.Status, UgcApplicationStatus.Hired, UgcActor.Brand);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);
        if (app.Campaign.Status != UgcCampaignStatus.Published) return Errors.Conflict("Kampanjen är stängd.");

        var hired = await _collabs.Query().CountAsync(x => x.CampaignId == app.CampaignId && x.Status != UgcCollabStatus.Cancelled, ct);
        if (hired >= app.Campaign.Slots) return Errors.Conflict("Alla platser är redan tillsatta — stäng kampanjen eller höj antalet platser i en ny.");

        var me = await _creatorService.GetOrCreateAsync(app.CreatorProfileId, ct);
        var now = DateTime.UtcNow;
        var collab = await _collabService.CreateFromApplicationAsync(app, app.Campaign, brand!, app.CreatorProfile, me, now, ct);
        UgcApplicationStateMachine.Apply(app, UgcApplicationStatus.Hired, UgcActor.Brand, now, "Anlitad.");

        // Last slot taken → the campaign is done recruiting and the rest get an answer.
        if (hired + 1 >= app.Campaign.Slots)
        {
            UgcCampaignStateMachine.Apply(app.Campaign, UgcCampaignStatus.Closed, UgcActor.System, now, true);
            var others = await _applications.Query().Include(a => a.CreatorProfile)
                .Where(a => a.CampaignId == app.CampaignId && a.Id != app.Id
                    && (a.Status == UgcApplicationStatus.Applied || a.Status == UgcApplicationStatus.Preselected)).ToListAsync(ct);
            foreach (var o in others)
            {
                UgcApplicationStateMachine.Apply(o, UgcApplicationStatus.Rejected, UgcActor.System, now, "Platserna är fyllda.");
                await Notify(o.CreatorProfile.UserId, NotificationType.UgcCancelled, $"Platserna i \"{app.Campaign.Title}\" är fyllda den här gången.", app.CampaignId);
            }
        }
        await _uow.SaveChangesAsync(ct);

        await Notify(app.CreatorProfile.UserId, NotificationType.UgcHired,
            $"Du är vald till \"{app.Campaign.Title}\" hos {brand!.CompanyName}! Så fort företaget accepterat avtalet" +
            (collab.Compensation == UgcCompensationType.ProductExchange ? "" : " och betalat") + " kan du acceptera kontraktet.", collab.Id);

        return await _collabService.GetAsync(brandUserId, collab.Id, ct);
    }

    // ── Internals ──────────────────────────────────────────────────

    private async Task<Result<UgcApplicationDto>> DecideAsync(Guid brandUserId, Guid applicationId, UgcApplicationStatus to, string? note, CancellationToken ct)
    {
        var (_, app, fail) = await OwnedAsync(brandUserId, applicationId, ct);
        if (fail != null) return fail;
        var check = UgcApplicationStateMachine.Check(app!.Status, to, UgcActor.Brand);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);
        UgcApplicationStateMachine.Apply(app, to, UgcActor.Brand, DateTime.UtcNow, string.IsNullOrWhiteSpace(note) ? null : note.Trim());
        await _uow.SaveChangesAsync(ct);

        if (to == UgcApplicationStatus.Rejected)
            await Notify(app.CreatorProfile.UserId, NotificationType.UgcCancelled,
                $"Ditt bud på \"{app.Campaign.Title}\" antogs inte den här gången." + (string.IsNullOrWhiteSpace(note) ? "" : $" Företaget skrev: {note.Trim()}"), app.CampaignId);

        var me = await _ugcCreators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == app.CreatorProfileId, ct);
        return UgcMapper.Application(app, app.Campaign, app.CreatorProfile, me, null);
    }

    private async Task<(BrandProfile?, UgcApplication?, Result<UgcApplicationDto>?)> OwnedAsync(Guid brandUserId, Guid applicationId, CancellationToken ct)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return (null, null, Errors.NotFound("Brand"));
        var app = await _applications.Query().Include(a => a.Campaign).Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == applicationId && a.Campaign.BrandProfileId == brand.Id, ct);
        if (app == null) return (brand, null, Errors.NotFound("Application", applicationId));
        return (brand, app, null);
    }

    private async Task<Dictionary<Guid, Guid>> CollabsByApplicationAsync(List<Guid> applicationIds, CancellationToken ct)
    {
        if (applicationIds.Count == 0) return new();
        var rows = await _collabs.Query().Where(c => c.ApplicationId != null && applicationIds.Contains(c.ApplicationId.Value))
            .Select(c => new { c.ApplicationId, c.Id }).ToListAsync(ct);
        return rows.GroupBy(r => r.ApplicationId!.Value).ToDictionary(g => g.Key, g => g.First().Id);
    }

    /// <summary>
    /// Ranking used in the brand's list: proven delivery outweighs everything,
    /// then geography, then engagement and rating. Documented so it can be tuned.
    /// </summary>
    internal static double Score(UgcApplication a, UgcCreatorProfile? p, UgcCampaign c)
    {
        if (p == null) return 0;
        var delivered = p.DeliveredCount;
        var onTimeRate = delivered == 0 ? 0.5 : (double)p.OnTimeCount / delivered;
        var regionMatch = !string.IsNullOrWhiteSpace(c.Region)
            && (string.Equals(c.Region, p.Region, StringComparison.OrdinalIgnoreCase) || string.Equals(c.Region, p.City, StringComparison.OrdinalIgnoreCase));
        var rating = p.RatingCount == 0 ? 0 : (double)p.AverageRating / 5.0;
        return onTimeRate * 3.0
             + Math.Min(delivered, 10) * 0.25
             + (regionMatch ? 1.0 : 0)
             + Math.Min((double)p.LikeFollowerRatio, 1.0) * 2.0
             + rating * 1.5
             + (p.Status == UgcCreatorStatus.Approved ? 0.5 : 0)
             - p.Strikes * 1.0;
    }

    private async Task Notify(Guid userId, NotificationType type, string message, Guid refId)
    {
        try { await _notify.SendAsync(userId, type, message, refId); }
        catch (Exception ex) { _logger.LogWarning(ex, "UGC notification failed for {User}", userId); }
    }
}
