using System.Text;
using CreatorPay.Application.Common;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Domain.Ugc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Ugc.Services;

public interface IUgcCollabService
{
    /// <summary>Hire: build the collab and its contract from a bid. Caller saves.</summary>
    Task<UgcCollab> CreateFromApplicationAsync(UgcApplication app, UgcCampaign campaign, BrandProfile brand, CreatorProfile creator, UgcCreatorProfile ugcCreator, DateTime now, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> DirectInviteAsync(Guid brandUserId, DirectInviteRequest request, CancellationToken ct = default);

    Task<Result<List<UgcCollabListDto>>> ListMineAsync(Guid userId, string? status, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> GetAsync(Guid userId, Guid id, CancellationToken ct = default);
    Task<Result<int>> CountNeedingMyActionAsync(Guid userId, CancellationToken ct = default);

    Task<Result<UgcCheckoutDto>> AcceptAsBrandAsync(Guid brandUserId, Guid id, CancellationToken ct = default);
    Task<Result<UgcCheckoutDto>> GetCheckoutAsync(Guid brandUserId, Guid id, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> AcceptAsCreatorAsync(Guid creatorUserId, Guid id, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> StartAsync(Guid creatorUserId, Guid id, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> SubmitAsync(Guid creatorUserId, Guid id, Stream file, string fileName, string contentType, long sizeBytes, string? comment, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> ApproveAsync(Guid brandUserId, Guid id, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> RequestRevisionAsync(Guid brandUserId, Guid id, RequestUgcRevisionRequest request, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> OpenDisputeAsync(Guid userId, Guid id, OpenUgcDisputeRequest request, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> CancelAsync(Guid userId, Guid id, CancelUgcCollabRequest request, CancellationToken ct = default);
    Task<Result<UgcCollabDetailDto>> RateAsync(Guid brandUserId, Guid id, RateUgcCollabRequest request, CancellationToken ct = default);

    Task<Result<List<UgcMessageDto>>> GetMessagesAsync(Guid userId, Guid id, CancellationToken ct = default);
    Task<Result<UgcMessageDto>> SendMessageAsync(Guid userId, Guid id, SendUgcMessageRequest request, CancellationToken ct = default);
    Task<Result<string>> GetLicenseHtmlAsync(Guid userId, Guid id, CancellationToken ct = default);
}

/// <summary>
/// The engagement from hire to paid. Every status change goes through the
/// state machine; every money move goes through the settlement service; the
/// UI only ever sees <c>AvailableActions</c>, so the rules live here alone.
/// </summary>
public sealed class UgcCollabService : IUgcCollabService
{
    private readonly IRepository<UgcCollab> _collabs;
    private readonly IRepository<UgcCollabEvent> _events;
    private readonly IRepository<UgcPayment> _payments;
    private readonly IRepository<UgcDeliverable> _deliverables;
    private readonly IRepository<UgcDispute> _disputes;
    private readonly IRepository<UgcMessage> _messages;
    private readonly IRepository<UgcCreatorProfile> _ugcCreators;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<User> _users;
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notify;
    private readonly IUgcPaymentGateway _gateway;
    private readonly IUgcFileStore _files;
    private readonly UgcSettlementService _settlement;
    private readonly UgcSettings _settings;
    private readonly IConfiguration _config;
    private readonly ILogger<UgcCollabService> _logger;

    public UgcCollabService(IRepository<UgcCollab> collabs, IRepository<UgcCollabEvent> events, IRepository<UgcPayment> payments,
        IRepository<UgcDeliverable> deliverables, IRepository<UgcDispute> disputes, IRepository<UgcMessage> messages,
        IRepository<UgcCreatorProfile> ugcCreators, IRepository<BrandProfile> brands, IRepository<CreatorProfile> creators, IRepository<User> users,
        IUnitOfWork uow, INotificationService notify, IUgcPaymentGateway gateway, IUgcFileStore files,
        UgcSettlementService settlement, UgcSettings settings, IConfiguration config, ILogger<UgcCollabService> logger)
    {
        _collabs = collabs; _events = events; _payments = payments; _deliverables = deliverables; _disputes = disputes; _messages = messages;
        _ugcCreators = ugcCreators; _brands = brands; _creators = creators; _users = users;
        _uow = uow; _notify = notify; _gateway = gateway; _files = files; _settlement = settlement; _settings = settings; _config = config; _logger = logger;
    }

    // ── Creation ───────────────────────────────────────────────────

    public Task<UgcCollab> CreateFromApplicationAsync(UgcApplication app, UgcCampaign campaign, BrandProfile brand, CreatorProfile creator, UgcCreatorProfile ugcCreator, DateTime now, CancellationToken ct = default)
    {
        var collab = Build(brand, creator, ugcCreator, now,
            title: campaign.Title, brief: UgcContractGenerator.RenderBrief(campaign),
            compensation: campaign.Compensation, amountOre: app.BidOre,
            productDescription: campaign.ProductDescription, productValueOre: campaign.ProductValueOre,
            rights: campaign.RightsPackage, deadlineDays: campaign.DeadlineDays);
        collab.CampaignId = campaign.Id;
        collab.ApplicationId = app.Id;
        _collabs.Add(collab);
        return Task.FromResult(collab);
    }

    public async Task<Result<UgcCollabDetailDto>> DirectInviteAsync(Guid brandUserId, DirectInviteRequest r, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        if (brand.Status != BrandStatus.Approved) return Errors.Forbidden("Företagskontot måste vara godkänt innan ni kan beställa.");
        if (string.IsNullOrWhiteSpace(brand.OrganizationNumber)) return Errors.Validation("Registrera organisationsnummer under Inställningar innan ni beställer.");

        if (!Enum.TryParse<UgcCompensationType>(r.Compensation, true, out var comp)) return Errors.Validation("Okänd ersättningstyp.");
        if (!Enum.TryParse<UgcRightsPackage>(r.RightsPackage, true, out var rights)) return Errors.Validation("Okänt rättighetspaket.");
        if (string.IsNullOrWhiteSpace(r.Title) || r.Title.Trim().Length < 3) return Errors.Validation("Ge uppdraget en titel.");
        if (r.Brief == null || string.IsNullOrWhiteSpace(r.Brief.Goal) || string.IsNullOrWhiteSpace(r.Brief.CallToAction)) return Errors.Validation("Briefen behöver mål och call to action.");
        if (r.DeadlineDays is < 1 or > 60) return Errors.Validation("Leveranstid 1–60 dagar.");
        if (comp != UgcCompensationType.ProductExchange && r.AmountOre < UgcCampaignService.MinPaidBudgetOre)
            return Errors.Validation($"Lägsta ersättning är {UgcFeeCalculator.FormatSek(UgcCampaignService.MinPaidBudgetOre)}.");
        if (comp != UgcCompensationType.Paid && string.IsNullOrWhiteSpace(r.ProductDescription)) return Errors.Validation("Beskriv produkten creatorn får.");

        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.Id == r.CreatorProfileId && c.Status == CreatorStatus.Approved, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var me = await _ugcCreators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == creator.Id, ct)
                 ?? new UgcCreatorProfile { CreatorProfileId = creator.Id };
        if (me.Status == UgcCreatorStatus.Suspended) return Errors.Conflict("Den här creatorn är avstängd från marknadsplatsen.");

        // Render the brief the same way a campaign would, so the contract reads the same.
        var tmp = new UgcCampaign { Title = r.Title };
        UgcMapper.ApplyBrief(tmp, r.Brief);
        tmp.VideoCount = Math.Max(1, r.Brief.VideoCount);
        tmp.LengthSeconds = r.Brief.LengthSeconds;

        var now = DateTime.UtcNow;
        var collab = Build(brand, creator, me, now,
            title: r.Title.Trim(), brief: UgcContractGenerator.RenderBrief(tmp),
            compensation: comp, amountOre: comp == UgcCompensationType.ProductExchange ? 0 : r.AmountOre,
            productDescription: r.ProductDescription?.Trim(), productValueOre: r.ProductValueOre is > 0 ? r.ProductValueOre : null,
            rights: rights, deadlineDays: r.DeadlineDays);
        _collabs.Add(collab);
        await _uow.SaveChangesAsync(ct);

        await Notify(creator.UserId, NotificationType.UgcHired,
            $"{brand.CompanyName} vill beställa en video av dig: \"{collab.Title}\"" +
            (collab.AgreedAmountOre > 0 ? $" för {UgcFeeCalculator.FormatSek(collab.AgreedAmountOre)}." : ".") +
            " Du kan acceptera kontraktet så fort företaget bekräftat" + (comp == UgcCompensationType.ProductExchange ? "." : " och betalat."), collab.Id);

        return await GetAsync(brandUserId, collab.Id, ct);
    }

    private UgcCollab Build(BrandProfile brand, CreatorProfile creator, UgcCreatorProfile ugcCreator, DateTime now,
        string title, string brief, UgcCompensationType compensation, long amountOre, string? productDescription, long? productValueOre,
        UgcRightsPackage rights, int deadlineDays)
    {
        var quote = UgcFeeCalculator.Quote(amountOre, _settings.PlatformFeePercent);
        var contract = UgcContractGenerator.Generate(new UgcContractInput(
            brand.CompanyName, brand.OrganizationNumber, creator.DisplayName, title, brief,
            compensation, quote, productDescription, productValueOre, rights,
            deadlineDays, _settings.AutoApproveDays, _settings.MaxRevisions, _settings.RevisionDeadlineDays,
            ugcCreator.AllowPortfolioUse, _settings.ContractTemplateVersion, now));

        return new UgcCollab
        {
            BrandProfileId = brand.Id, CreatorProfileId = creator.Id,
            Title = title, BriefSnapshot = brief,
            Compensation = compensation,
            AgreedAmountOre = quote.CreatorAmountOre, PlatformFeeOre = quote.PlatformFeeOre, BrandTotalOre = quote.BrandTotalOre, FeePercentApplied = quote.FeePercent,
            ProductDescription = productDescription, ProductValueOre = productValueOre,
            RightsPackage = rights, DeadlineDays = deadlineDays, MaxRevisions = _settings.MaxRevisions,
            ContractText = contract.Text, ContractHash = contract.Sha256, ContractTemplateVersion = contract.TemplateVersion,
            Status = UgcCollabStatus.Invited,
        };
    }

    // ── Reading ────────────────────────────────────────────────────

    public async Task<Result<List<UgcCollabListDto>>> ListMineAsync(Guid userId, string? status, CancellationToken ct = default)
    {
        var (actor, brandId, creatorId) = await WhoAsync(userId, ct);
        if (actor == null) return Errors.Forbidden("Ingen åtkomst.");

        var q = _collabs.Query().Include(c => c.BrandProfile).Include(c => c.CreatorProfile).Include(c => c.Payment).Include(c => c.Deliverables).AsQueryable();
        q = actor switch
        {
            UgcActor.Brand => q.Where(c => c.BrandProfileId == brandId),
            UgcActor.Creator => q.Where(c => c.CreatorProfileId == creatorId),
            _ => q,
        };
        if (Enum.TryParse<UgcCollabStatus>(status, true, out var s)) q = q.Where(c => c.Status == s);

        var list = await q.OrderByDescending(c => c.UpdatedAt).Take(300).ToListAsync(ct);
        var ids = list.Select(c => c.Id).ToList();
        var unread = await _messages.Query()
            .Where(m => ids.Contains(m.CollabId) && !m.IsRead && m.SenderUserId != userId)
            .GroupBy(m => m.CollabId).Select(g => new { g.Key, N = g.Count() }).ToListAsync(ct);
        var unreadBy = unread.ToDictionary(x => x.Key, x => x.N);

        return list.Select(c => UgcMapper.CollabList(c, actor.Value, unreadBy.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<Result<UgcCollabDetailDto>> GetAsync(Guid userId, Guid id, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(userId, id, ct);
        if (fail != null) return fail;
        return await DetailAsync(collab!, actor!.Value, userId, ct);
    }

    public async Task<Result<int>> CountNeedingMyActionAsync(Guid userId, CancellationToken ct = default)
    {
        var (actor, brandId, creatorId) = await WhoAsync(userId, ct);
        if (actor is null or UgcActor.Admin) return 0;
        var mine = await _collabs.Query().Include(c => c.Payment)
            .Where(c => actor == UgcActor.Brand ? c.BrandProfileId == brandId : c.CreatorProfileId == creatorId)
            .Where(c => c.Status != UgcCollabStatus.Paid && c.Status != UgcCollabStatus.Cancelled)
            .ToListAsync(ct);
        return mine.Count(c => UgcMapper.AvailableActions(c, actor.Value, UgcMapper.IsFunded(c)).Any(a => a is "accept" or "pay" or "approve" or "submit"));
    }

    // ── Brand: accept + pay ────────────────────────────────────────

    public async Task<Result<UgcCheckoutDto>> AcceptAsBrandAsync(Guid brandUserId, Guid id, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(brandUserId, id, ct);
        if (fail != null) return fail.Error!;
        if (actor != UgcActor.Brand) return Errors.Forbidden("Bara företaget kan acceptera här.");
        if (collab!.Status != UgcCollabStatus.Invited) return Errors.Conflict("Avtalet är redan igång.");

        // The hash on file must still be the hash of the text on file.
        if (UgcContractGenerator.Hash(collab.ContractText) != collab.ContractHash)
            return Errors.Conflict("Kontraktstexten stämmer inte med sin kontrollsumma — kontakta support.");

        var now = DateTime.UtcNow;
        if (collab.BrandAcceptedAt == null)
        {
            collab.BrandAcceptedAt = now;
            _events.Add(new UgcCollabEvent { CollabId = collab.Id, FromStatus = collab.Status, ToStatus = collab.Status, Actor = UgcActor.Brand, ActorUserId = brandUserId, Note = "Företaget accepterade kontraktet." });
            await _uow.SaveChangesAsync(ct);
        }

        if (collab.Compensation == UgcCompensationType.ProductExchange)
        {
            await TryCompleteAcceptanceAsync(collab, now, ct);
            await _uow.SaveChangesAsync(ct);
            if (collab.Status == UgcCollabStatus.Invited)
                await Notify(collab.CreatorProfile.UserId, NotificationType.UgcContractAccepted, $"{collab.BrandProfile.CompanyName} har accepterat avtalet för \"{collab.Title}\". Din tur att acceptera kontraktet.", collab.Id);
            return new UgcCheckoutDto(null, true, true, null);
        }

        return await CheckoutAsync(collab, brandUserId, ct);
    }

    public async Task<Result<UgcCheckoutDto>> GetCheckoutAsync(Guid brandUserId, Guid id, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(brandUserId, id, ct);
        if (fail != null) return fail.Error!;
        if (actor != UgcActor.Brand) return Errors.Forbidden("Bara företaget kan betala.");
        if (collab!.BrandAcceptedAt == null) return Errors.Conflict("Acceptera kontraktet först.");
        if (collab.Compensation == UgcCompensationType.ProductExchange) return new UgcCheckoutDto(null, true, true, null);
        return await CheckoutAsync(collab, brandUserId, ct);
    }

    private async Task<Result<UgcCheckoutDto>> CheckoutAsync(UgcCollab collab, Guid brandUserId, CancellationToken ct)
    {
        if (UgcMapper.IsFunded(collab)) return new UgcCheckoutDto(null, true, false, null);
        if (!_gateway.IsConfigured) return new UgcCheckoutDto(null, false, false, UnconfiguredUgcPaymentGateway.Message);

        var email = await _users.Query().Where(u => u.Id == brandUserId).Select(u => u.Email).FirstAsync(ct);
        var baseUrl = (_config["Frontend:BaseUrl"] ?? "https://www.vyrle.co").TrimEnd('/');
        var result = await _gateway.CreateCheckoutAsync(new UgcCheckoutRequest(
            collab.Id, collab.BrandTotalOre, "SEK", email,
            $"VYRLE · {collab.Title} · {collab.CreatorProfile.DisplayName}",
            $"{baseUrl}/brand/ugc/collabs/{collab.Id}?paid=1", $"{baseUrl}/brand/ugc/collabs/{collab.Id}?paid=0"), ct);
        if (!result.Success) return Errors.Conflict(result.Error ?? "Kunde inte starta betalningen.");

        if (collab.Payment == null)
        {
            collab.Payment = new UgcPayment { CollabId = collab.Id, CreatorAmountOre = collab.AgreedAmountOre, PlatformFeeOre = collab.PlatformFeeOre };
            _payments.Add(collab.Payment);
        }
        collab.Payment.CheckoutSessionId = result.ExternalId;
        collab.Payment.Status = UgcPaymentStatus.Pending;
        await _uow.SaveChangesAsync(ct);
        return new UgcCheckoutDto(result.Url, false, false, null);
    }

    // ── Creator: accept / start / submit ───────────────────────────

    public async Task<Result<UgcCollabDetailDto>> AcceptAsCreatorAsync(Guid creatorUserId, Guid id, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(creatorUserId, id, ct);
        if (fail != null) return fail;
        if (actor != UgcActor.Creator) return Errors.Forbidden("Bara creatorn kan acceptera här.");
        if (collab!.Status != UgcCollabStatus.Invited) return Errors.Conflict("Avtalet är redan igång.");
        if (collab.BrandAcceptedAt == null) return Errors.Conflict("Företaget har inte accepterat avtalet ännu.");

        var me = await _ugcCreators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == collab.CreatorProfileId, ct);
        if (me == null || !UgcVerificationRule.CanApply(me.Status, collab.Compensation, me.PayoutOnboardingComplete, me.HasFTax, _settings.RequireFTaxForPaid))
            return Errors.Forbidden(me?.Status == UgcCreatorStatus.Suspended ? "Ditt konto på marknadsplatsen är avstängt."
                : me == null || me.Status == UgcCreatorStatus.Pending ? "Din profil måste verifieras först."
                : "Slutför utbetalningsregistreringen innan du tar betalda uppdrag.");

        if (!UgcMapper.IsFunded(collab)) return Errors.Conflict("Företaget har inte betalat ännu — du får en notis så fort pengarna är på plats.");

        var now = DateTime.UtcNow;
        collab.CreatorAcceptedAt ??= now;
        await TryCompleteAcceptanceAsync(collab, now, ct);
        await _uow.SaveChangesAsync(ct);
        return await DetailAsync(collab, UgcActor.Creator, creatorUserId, ct);
    }

    /// <summary>Both signatures and the money → Accepted, and the deadline clock starts.</summary>
    private async Task TryCompleteAcceptanceAsync(UgcCollab collab, DateTime now, CancellationToken ct)
    {
        if (collab.Status != UgcCollabStatus.Invited || collab.BrandAcceptedAt == null || collab.CreatorAcceptedAt == null) return;
        var ctx = UgcTransitionContext.From(collab, UgcMapper.IsFunded(collab), _settings.AutoApproveDays, _settings.RevisionDeadlineDays);
        if (!UgcCollabStateMachine.Check(collab.Status, UgcCollabStatus.Accepted, UgcActor.Creator, ctx).Allowed) return;
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Accepted, UgcActor.Creator, now, ctx, note: "Båda parter har accepterat."));
        await Notify(collab.BrandProfile.UserId, NotificationType.UgcContractAccepted,
            $"{collab.CreatorProfile.DisplayName} har accepterat kontraktet för \"{collab.Title}\". Leverans senast {collab.DeadlineAt:yyyy-MM-dd}.", collab.Id);
        await Notify(collab.CreatorProfile.UserId, NotificationType.UgcContractAccepted,
            $"Avtalet för \"{collab.Title}\" gäller. Leverera senast {collab.DeadlineAt:yyyy-MM-dd} — lycka till!", collab.Id);
    }

    public async Task<Result<UgcCollabDetailDto>> StartAsync(Guid creatorUserId, Guid id, CancellationToken ct = default)
        => await TransitionAsync(creatorUserId, id, UgcActor.Creator, UgcCollabStatus.InProgress, null, ct);

    public async Task<Result<UgcCollabDetailDto>> SubmitAsync(Guid creatorUserId, Guid id, Stream file, string fileName, string contentType, long sizeBytes, string? comment, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(creatorUserId, id, ct);
        if (fail != null) return fail;
        if (actor != UgcActor.Creator) return Errors.Forbidden("Bara creatorn kan leverera.");

        var ctx = Ctx(collab!);
        var check = UgcCollabStateMachine.Check(collab!.Status, UgcCollabStatus.Submitted, UgcActor.Creator, ctx);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);
        var invalid = UgcFileRules.Validate(sizeBytes, fileName, contentType);
        if (invalid != null) return Errors.Validation(invalid);

        var version = (await _deliverables.Query().Where(d => d.CollabId == collab.Id).MaxAsync(d => (int?)d.Version, ct) ?? 0) + 1;
        UgcStoredFile stored;
        try { stored = await _files.SaveAsync(file, fileName, contentType, collab.Id, version, ct); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UGC upload failed for collab {Id}", collab.Id);
            return Errors.Conflict("Uppladdningen misslyckades. Försök igen.");
        }

        var now = DateTime.UtcNow;
        var deliverable = new UgcDeliverable
        {
            CollabId = collab.Id, Version = version, FileUrl = stored.Key, FileKey = stored.Key,
            FileSizeBytes = stored.SizeBytes, ContentType = stored.ContentType,
            CreatorComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
        };
        _deliverables.Add(deliverable);          // EF fixup also places it in collab.Deliverables
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Submitted, UgcActor.Creator, now, ctx, creatorUserId, $"Version {version} inlämnad."));
        await _uow.SaveChangesAsync(ct);

        await Notify(collab.BrandProfile.UserId, NotificationType.UgcDelivered,
            $"{collab.CreatorProfile.DisplayName} har levererat \"{collab.Title}\" (version {version}). Granska inom {_settings.AutoApproveDays} dagar — annars godkänns den automatiskt.", collab.Id);
        return await DetailAsync(collab, UgcActor.Creator, creatorUserId, ct);
    }

    // ── Brand: approve / revision / rate ───────────────────────────

    public async Task<Result<UgcCollabDetailDto>> ApproveAsync(Guid brandUserId, Guid id, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(brandUserId, id, ct);
        if (fail != null) return fail;
        if (actor != UgcActor.Brand) return Errors.Forbidden("Bara företaget kan godkänna.");

        var ctx = Ctx(collab!);
        var check = UgcCollabStateMachine.Check(collab!.Status, UgcCollabStatus.Approved, UgcActor.Brand, ctx);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);

        var now = DateTime.UtcNow;
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Approved, UgcActor.Brand, now, ctx, brandUserId, "Godkänd av företaget."));
        var me = await _ugcCreators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == collab.CreatorProfileId, ct)
                 ?? new UgcCreatorProfile { CreatorProfileId = collab.CreatorProfileId };
        UgcSettlementService.RecordDelivery(collab, me);
        var paid = await _settlement.TrySettleApprovedAsync(collab, me, _settings, now, ct);
        await _uow.SaveChangesAsync(ct);

        await Notify(collab.CreatorProfile.UserId, paid ? NotificationType.UgcPaid : NotificationType.UgcApproved,
            paid ? $"\"{collab.Title}\" är godkänd och utbetalningen är genomförd." : $"\"{collab.Title}\" är godkänd. Utbetalningen är på väg.", collab.Id);
        return await DetailAsync(collab, UgcActor.Brand, brandUserId, ct);
    }

    public async Task<Result<UgcCollabDetailDto>> RequestRevisionAsync(Guid brandUserId, Guid id, RequestUgcRevisionRequest r, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(brandUserId, id, ct);
        if (fail != null) return fail;
        if (actor != UgcActor.Brand) return Errors.Forbidden("Bara företaget kan begära revision.");
        var feedback = (r.Feedback ?? "").Trim();
        if (feedback.Length < 10) return Errors.Validation("Skriv vad som ska ändras — konkret feedback är ett krav för revision.");

        var ctx = Ctx(collab!);
        var check = UgcCollabStateMachine.Check(collab!.Status, UgcCollabStatus.RevisionRequested, UgcActor.Brand, ctx);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);

        var now = DateTime.UtcNow;
        var latest = await _deliverables.Query().Where(d => d.CollabId == collab.Id).OrderByDescending(d => d.Version).FirstOrDefaultAsync(ct);
        if (latest != null) { latest.BrandFeedback = feedback; latest.FeedbackAt = now; }
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.RevisionRequested, UgcActor.Brand, now, ctx, brandUserId, feedback));
        await _uow.SaveChangesAsync(ct);

        await Notify(collab.CreatorProfile.UserId, NotificationType.UgcRevisionRequested,
            $"{collab.BrandProfile.CompanyName} vill ha en ändring i \"{collab.Title}\" (runda {collab.RevisionCount} av {collab.MaxRevisions}): {feedback}. Ny deadline {collab.DeadlineAt:yyyy-MM-dd}.", collab.Id);
        return await DetailAsync(collab, UgcActor.Brand, brandUserId, ct);
    }

    public async Task<Result<UgcCollabDetailDto>> RateAsync(Guid brandUserId, Guid id, RateUgcCollabRequest r, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(brandUserId, id, ct);
        if (fail != null) return fail;
        if (actor != UgcActor.Brand) return Errors.Forbidden("Bara företaget kan betygsätta.");
        if (collab!.Status is not (UgcCollabStatus.Approved or UgcCollabStatus.Paid)) return Errors.Conflict("Betyg sätts efter godkänd leverans.");
        if (r.Rating is < 1 or > 5) return Errors.Validation("Betyg 1–5.");
        if (collab.BrandRating != null) return Errors.Conflict("Betyget är redan satt.");

        collab.BrandRating = r.Rating;
        var me = await _ugcCreators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == collab.CreatorProfileId, ct);
        if (me != null)
        {
            me.AverageRating = Math.Round((me.AverageRating * me.RatingCount + r.Rating) / (me.RatingCount + 1), 2);
            me.RatingCount += 1;
        }
        await _uow.SaveChangesAsync(ct);
        return await DetailAsync(collab, UgcActor.Brand, brandUserId, ct);
    }

    // ── Either side: dispute / cancel ──────────────────────────────

    public async Task<Result<UgcCollabDetailDto>> OpenDisputeAsync(Guid userId, Guid id, OpenUgcDisputeRequest r, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(userId, id, ct);
        if (fail != null) return fail;
        if (actor is not (UgcActor.Brand or UgcActor.Creator)) return Errors.Forbidden("Bara parterna kan öppna en tvist.");
        var reason = (r.Reason ?? "").Trim();
        if (reason.Length < 20) return Errors.Validation("Beskriv tvisten (minst 20 tecken): vad i leveransen avviker från briefen?");

        var ctx = Ctx(collab!);
        var check = UgcCollabStateMachine.Check(collab!.Status, UgcCollabStatus.Disputed, actor.Value, ctx);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);

        var now = DateTime.UtcNow;
        var dispute = new UgcDispute { CollabId = collab.Id, OpenedByUserId = userId, OpenedBy = actor.Value, Reason = reason };
        _disputes.Add(dispute);
        collab.Dispute = dispute;
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Disputed, actor.Value, now, ctx, userId, reason));
        await _uow.SaveChangesAsync(ct);

        var other = actor == UgcActor.Brand ? collab.CreatorProfile.UserId : collab.BrandProfile.UserId;
        await Notify(other, NotificationType.UgcDispute, $"En tvist har öppnats om \"{collab.Title}\". VYRLE granskar leveransen mot briefen och återkommer.", collab.Id);
        var admins = await _users.Query().Where(u => u.Role == UserRole.Admin && u.Status == UserStatus.Active).Select(u => u.Id).ToListAsync(ct);
        foreach (var a in admins)
            await Notify(a, NotificationType.UgcDispute, $"Ny tvist: \"{collab.Title}\" ({collab.BrandProfile.CompanyName} ↔ {collab.CreatorProfile.DisplayName}). Öppnad av {actor}: {reason}", collab.Id);
        return await DetailAsync(collab, actor.Value, userId, ct);
    }

    public async Task<Result<UgcCollabDetailDto>> CancelAsync(Guid userId, Guid id, CancelUgcCollabRequest r, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(userId, id, ct);
        if (fail != null) return fail;

        // Who may pull out when: a brand only before the creator has signed; a
        // creator any time before delivery; an admin whenever.
        var allowed = actor switch
        {
            UgcActor.Brand => collab!.Status == UgcCollabStatus.Invited && collab.CreatorAcceptedAt == null,
            UgcActor.Creator => collab!.Status is UgcCollabStatus.Invited or UgcCollabStatus.Accepted or UgcCollabStatus.InProgress,
            UgcActor.Admin => true,
            _ => false,
        };
        if (!allowed) return Errors.Conflict("Uppdraget kan inte avbrytas i det här läget.");

        var ctx = Ctx(collab!);
        var check = UgcCollabStateMachine.Check(collab!.Status, UgcCollabStatus.Cancelled, actor!.Value, ctx);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);

        var now = DateTime.UtcNow;
        var reason = string.IsNullOrWhiteSpace(r.Reason) ? $"Avbrutet av {actor}." : r.Reason.Trim();
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Cancelled, actor.Value, now, ctx, userId, reason));
        await _settlement.TryRefundAsync(collab, now, ct);
        await _uow.SaveChangesAsync(ct);

        if (actor != UgcActor.Brand) await Notify(collab.BrandProfile.UserId, NotificationType.UgcCancelled, $"\"{collab.Title}\" avbröts: {reason}" + (collab.Payment?.Status == UgcPaymentStatus.Refunded ? " Beloppet återbetalas." : ""), collab.Id);
        if (actor != UgcActor.Creator) await Notify(collab.CreatorProfile.UserId, NotificationType.UgcCancelled, $"\"{collab.Title}\" avbröts: {reason}", collab.Id);
        return await DetailAsync(collab, actor.Value, userId, ct);
    }

    // ── Messages ───────────────────────────────────────────────────

    public async Task<Result<List<UgcMessageDto>>> GetMessagesAsync(Guid userId, Guid id, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(userId, id, ct);
        if (fail != null) return fail.Error!;
        var rows = await _messages.Query().Where(m => m.CollabId == id).OrderBy(m => m.CreatedAt).ToListAsync(ct);
        var unread = rows.Where(m => !m.IsRead && m.SenderUserId != userId).ToList();
        if (unread.Count > 0)
        {
            foreach (var m in unread) { m.IsRead = true; m.ReadAt = DateTime.UtcNow; }
            await _uow.SaveChangesAsync(ct);
        }
        return rows.Select(m => Map(m, collab!)).ToList();
    }

    public async Task<Result<UgcMessageDto>> SendMessageAsync(Guid userId, Guid id, SendUgcMessageRequest r, CancellationToken ct = default)
    {
        var (collab, actor, fail) = await LoadAsync(userId, id, ct);
        if (fail != null) return fail.Error!;
        var body = (r.Body ?? "").Trim();
        if (body.Length == 0) return Errors.Validation("Skriv ett meddelande.");
        if (body.Length > 4000) return Errors.Validation("Högst 4000 tecken.");

        var m = new UgcMessage { CollabId = id, SenderUserId = userId, SenderRole = actor!.Value, Body = body, AttachmentUrl = string.IsNullOrWhiteSpace(r.AttachmentUrl) ? null : r.AttachmentUrl.Trim() };
        _messages.Add(m);
        await _uow.SaveChangesAsync(ct);

        var other = actor == UgcActor.Brand ? collab!.CreatorProfile.UserId : collab!.BrandProfile.UserId;
        if (actor != UgcActor.Admin)
            await Notify(other, NotificationType.SystemMessage, $"Nytt meddelande i \"{collab.Title}\": {(body.Length > 140 ? body[..140] + "…" : body)}", collab.Id);
        return Map(m, collab);
    }

    private static UgcMessageDto Map(UgcMessage m, UgcCollab c) => new(
        m.Id, m.SenderUserId, m.SenderRole.ToString(),
        m.SenderRole switch { UgcActor.Brand => c.BrandProfile.CompanyName, UgcActor.Creator => c.CreatorProfile.DisplayName, _ => "VYRLE" },
        m.Body, m.AttachmentUrl, m.IsRead, m.CreatedAt);

    // ── License certificate ────────────────────────────────────────

    public async Task<Result<string>> GetLicenseHtmlAsync(Guid userId, Guid id, CancellationToken ct = default)
    {
        var (collab, _, fail) = await LoadAsync(userId, id, ct);
        if (fail != null) return fail.Error!;
        if (collab!.Status != UgcCollabStatus.Paid) return Errors.Conflict("Licensbeviset utfärdas när leveransen är godkänd och betald.");

        var rights = UgcContractGenerator.RightsClause(collab.RightsPackage);
        // Escape only markup — the page is UTF-8, so "å" stays "å" (WebUtility would write &#229;).
        static string H(string? s) => (s ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
        var sb = new StringBuilder();
        sb.Append("<!doctype html><html lang=\"sv\"><head><meta charset=\"utf-8\"><title>Licensbevis · VYRLE</title>");
        sb.Append("<style>body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0B0F17;background:#fff;margin:0;padding:48px;max-width:760px}h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;letter-spacing:.06em;text-transform:uppercase;color:#6E7480}p,li{font-size:14.5px;line-height:1.6}.mark{color:#F1A88F;font-weight:700}table{border-collapse:collapse;width:100%}td{padding:6px 0;font-size:14px;vertical-align:top}td:first-child{color:#6E7480;width:180px}.hash{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all}.foot{margin-top:40px;font-size:12px;color:#B7BCC8}@media print{body{padding:24px}}</style></head><body>");
        sb.Append("<div class=\"mark\">✦ VYRLE</div><h1>Licensbevis</h1><p>Detta bevis intygar att leveransen nedan är godkänd och betald via VYRLE, och att Företaget innehar de rättigheter som anges.</p>");
        sb.Append("<h2>Parter och uppdrag</h2><table>");
        sb.Append($"<tr><td>Företag</td><td>{H(collab.BrandProfile.CompanyName)}{(string.IsNullOrWhiteSpace(collab.BrandProfile.OrganizationNumber) ? "" : $", org.nr {H(collab.BrandProfile.OrganizationNumber)}")}</td></tr>");
        sb.Append($"<tr><td>Creator</td><td>{H(collab.CreatorProfile.DisplayName)}</td></tr>");
        sb.Append($"<tr><td>Uppdrag</td><td>{H(collab.Title)}</td></tr>");
        sb.Append($"<tr><td>Godkänd</td><td>{collab.ApprovedAt:yyyy-MM-dd HH:mm} UTC</td></tr>");
        sb.Append($"<tr><td>Betald</td><td>{collab.PaidAt:yyyy-MM-dd HH:mm} UTC</td></tr>");
        sb.Append($"<tr><td>Ersättning</td><td>{(collab.Compensation == UgcCompensationType.ProductExchange ? "Produktbyte" : UgcFeeCalculator.FormatSek(collab.AgreedAmountOre))}</td></tr>");
        sb.Append($"<tr><td>Avtalsversion</td><td>{H(collab.ContractTemplateVersion)}</td></tr>");
        sb.Append($"<tr><td>Kontrollsumma</td><td class=\"hash\">{H(collab.ContractHash)}</td></tr>");
        sb.Append("</table><h2>Rättigheter</h2>");
        sb.Append($"<p>{H(rights).Replace("\n\n", "</p><p>").Replace("**", "")}</p>");
        sb.Append("<h2>Leverans</h2><ul>");
        foreach (var d in collab.Deliverables.OrderBy(d => d.Version))
            sb.Append($"<li>Version {d.Version} · {H(d.ContentType)} · {d.FileSizeBytes / 1024 / 1024} MB · {d.CreatedAt:yyyy-MM-dd}</li>");
        sb.Append("</ul><p class=\"foot\">Utfärdat av VYRLE · www.vyrle.co · Beviset kan verifieras mot kontraktets kontrollsumma i VYRLE.</p></body></html>");
        return sb.ToString();
    }

    // ── Internals ──────────────────────────────────────────────────

    private UgcTransitionContext Ctx(UgcCollab c) =>
        UgcTransitionContext.From(c, UgcMapper.IsFunded(c), _settings.AutoApproveDays, _settings.RevisionDeadlineDays);

    private async Task<Result<UgcCollabDetailDto>> TransitionAsync(Guid userId, Guid id, UgcActor expected, UgcCollabStatus to, string? note, CancellationToken ct)
    {
        var (collab, actor, fail) = await LoadAsync(userId, id, ct);
        if (fail != null) return fail;
        if (actor != expected) return Errors.Forbidden("Ingen åtkomst.");
        var ctx = Ctx(collab!);
        var check = UgcCollabStateMachine.Check(collab!.Status, to, expected, ctx);
        if (!check.Allowed) return Errors.Conflict(check.Reason!);
        _events.Add(UgcCollabStateMachine.Apply(collab, to, expected, DateTime.UtcNow, ctx, userId, note));
        await _uow.SaveChangesAsync(ct);
        return await DetailAsync(collab, expected, userId, ct);
    }

    private async Task<(UgcActor? Actor, Guid? BrandId, Guid? CreatorId)> WhoAsync(Guid userId, CancellationToken ct)
    {
        var brandId = await _brands.Query().Where(b => b.UserId == userId).Select(b => (Guid?)b.Id).FirstOrDefaultAsync(ct);
        if (brandId != null) return (UgcActor.Brand, brandId, null);
        var creatorId = await _creators.Query().Where(c => c.UserId == userId).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(ct);
        if (creatorId != null) return (UgcActor.Creator, null, creatorId);
        var isAdmin = await _users.Query().AnyAsync(u => u.Id == userId && u.Role == UserRole.Admin, ct);
        return isAdmin ? (UgcActor.Admin, null, null) : (null, null, null);
    }

    private async Task<(UgcCollab?, UgcActor?, Result<UgcCollabDetailDto>?)> LoadAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var collab = await _collabs.Query()
            .Include(c => c.BrandProfile).Include(c => c.CreatorProfile)
            .Include(c => c.Payment).Include(c => c.Dispute).Include(c => c.Deliverables).Include(c => c.Events)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (collab == null) return (null, null, Errors.NotFound("Collab", id));

        UgcActor? actor = collab.BrandProfile.UserId == userId ? UgcActor.Brand
            : collab.CreatorProfile.UserId == userId ? UgcActor.Creator
            : await _users.Query().AnyAsync(u => u.Id == userId && u.Role == UserRole.Admin, ct) ? UgcActor.Admin
            : null;
        if (actor == null) return (collab, null, Errors.Forbidden("Ingen åtkomst till det här uppdraget."));
        return (collab, actor, null);
    }

    private async Task<UgcCollabDetailDto> DetailAsync(UgcCollab collab, UgcActor actor, Guid userId, CancellationToken ct)
    {
        var deliverables = new List<UgcDeliverableDto>();
        foreach (var d in collab.Deliverables.OrderByDescending(d => d.Version))
        {
            string url;
            try { url = await _files.GetUrlAsync(d.FileKey ?? d.FileUrl, ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "UGC file url failed for {Key}", d.FileKey); url = ""; }
            deliverables.Add(new UgcDeliverableDto(d.Id, d.Version, url, d.ContentType, d.FileSizeBytes, d.DurationSeconds, d.CreatorComment, d.BrandFeedback, d.FeedbackAt, d.CreatedAt));
        }
        var unread = await _messages.Query().CountAsync(m => m.CollabId == collab.Id && !m.IsRead && m.SenderUserId != userId, ct);
        return UgcMapper.CollabDetail(collab, actor, deliverables, unread);
    }

    private async Task Notify(Guid userId, NotificationType type, string message, Guid refId)
    {
        try { await _notify.SendAsync(userId, type, message, refId); }
        catch (Exception ex) { _logger.LogWarning(ex, "UGC notification failed for {User}", userId); }
    }
}
