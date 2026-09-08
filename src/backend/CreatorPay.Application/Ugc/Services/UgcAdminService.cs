using CreatorPay.Application.Common;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Domain.Ugc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Ugc.Services;

public interface IUgcAdminService
{
    Task<Result<UgcAdminOverviewDto>> GetOverviewAsync(CancellationToken ct = default);
    Task<Result<List<UgcAdminCreatorRowDto>>> ListCreatorsAsync(string? status, CancellationToken ct = default);
    Task<Result<UgcAdminCreatorRowDto>> SetCreatorStatusAsync(Guid adminUserId, Guid creatorProfileId, SetUgcCreatorStatusRequest request, CancellationToken ct = default);
    Task<Result<List<UgcAdminDisputeRowDto>>> ListDisputesAsync(bool openOnly, CancellationToken ct = default);
    Task<Result<UgcAdminDisputeRowDto>> ResolveDisputeAsync(Guid adminUserId, Guid disputeId, ResolveUgcDisputeRequest request, CancellationToken ct = default);
    /// <summary>Record money received outside the gateway (bank transfer, or testing before Stripe keys exist).</summary>
    Task<Result<UgcCollabDetailDto>> MarkFundedManuallyAsync(Guid adminUserId, Guid collabId, string? note, CancellationToken ct = default);
}

/// <summary>Verification queue, dispute desk, and the numbers behind the marketplace.</summary>
public sealed class UgcAdminService : IUgcAdminService
{
    private readonly IRepository<UgcCreatorProfile> _creators;
    private readonly IRepository<UgcCollab> _collabs;
    private readonly IRepository<UgcCollabEvent> _events;
    private readonly IRepository<UgcDispute> _disputes;
    private readonly IRepository<UgcCampaign> _campaigns;
    private readonly IRepository<UgcPayment> _payments;
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notify;
    private readonly IAuditService _audit;
    private readonly UgcSettlementService _settlement;
    private readonly IUgcWebhookService _webhooks;
    private readonly IUgcCollabService _collabService;
    private readonly IUgcPaymentGateway _gateway;
    private readonly IUgcFileStore _files;
    private readonly IUgcBriefGenerator _brief;
    private readonly UgcSettings _settings;
    private readonly ILogger<UgcAdminService> _logger;

    public UgcAdminService(IRepository<UgcCreatorProfile> creators, IRepository<UgcCollab> collabs, IRepository<UgcCollabEvent> events,
        IRepository<UgcDispute> disputes, IRepository<UgcCampaign> campaigns, IRepository<UgcPayment> payments, IUnitOfWork uow,
        INotificationService notify, IAuditService audit, UgcSettlementService settlement, IUgcWebhookService webhooks,
        IUgcCollabService collabService, IUgcPaymentGateway gateway, IUgcFileStore files, IUgcBriefGenerator brief,
        UgcSettings settings, ILogger<UgcAdminService> logger)
    {
        _creators = creators; _collabs = collabs; _events = events; _disputes = disputes; _campaigns = campaigns; _payments = payments;
        _uow = uow; _notify = notify; _audit = audit; _settlement = settlement; _webhooks = webhooks; _collabService = collabService;
        _gateway = gateway; _files = files; _brief = brief; _settings = settings; _logger = logger;
    }

    public async Task<Result<UgcAdminOverviewDto>> GetOverviewAsync(CancellationToken ct = default)
    {
        var pending = await _creators.Query().CountAsync(p => p.Status == UgcCreatorStatus.Pending, ct);
        var verified = await _creators.Query().CountAsync(p => p.Status == UgcCreatorStatus.Verified, ct);
        var openDisputes = await _disputes.Query().CountAsync(d => d.Status == UgcDisputeStatus.Open, ct);
        var active = await _collabs.Query().CountAsync(c => c.Status != UgcCollabStatus.Paid && c.Status != UgcCollabStatus.Cancelled, ct);
        var published = await _campaigns.Query().CountAsync(c => c.Status == UgcCampaignStatus.Published, ct);
        var held = await _payments.Query().Where(p => p.Status == UgcPaymentStatus.Held).SumAsync(p => (long?)p.BrandPaidOre, ct) ?? 0;
        var paidOut = await _payments.Query().SumAsync(p => (long?)p.TransferredOre, ct) ?? 0;
        var fees = await _collabs.Query().Where(c => c.Status == UgcCollabStatus.Paid && c.Compensation != UgcCompensationType.ProductExchange)
            .SumAsync(c => (long?)c.PlatformFeeOre, ct) ?? 0;

        return new UgcAdminOverviewDto(pending, verified, openDisputes, active, published, held, paidOut, fees,
            _settings.PlatformFeePercent, _settings.AutoApproveDays, _settings.RevisionDeadlineDays, _settings.MaxRevisions, _settings.StrikesToSuspend,
            _settings.AutoVerifyMinFollowers, _settings.AutoVerifyMinLikeFollowerRatio, _settings.RequireFTaxForPaid,
            _gateway.IsConfigured, _files.IsCloud, _brief.IsConfigured, _settings.ContractTemplateVersion);
    }

    public async Task<Result<List<UgcAdminCreatorRowDto>>> ListCreatorsAsync(string? status, CancellationToken ct = default)
    {
        var q = _creators.Query().Include(p => p.CreatorProfile).ThenInclude(c => c.User)
            .Include(p => p.CreatorProfile).ThenInclude(c => c.TikTokAccount).AsQueryable();
        if (Enum.TryParse<UgcCreatorStatus>(status, true, out var s)) q = q.Where(p => p.Status == s);
        var rows = await q.OrderBy(p => p.Status).ThenBy(p => p.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(Row).ToList();
    }

    public async Task<Result<UgcAdminCreatorRowDto>> SetCreatorStatusAsync(Guid adminUserId, Guid creatorProfileId, SetUgcCreatorStatusRequest r, CancellationToken ct = default)
    {
        if (!Enum.TryParse<UgcCreatorStatus>(r.Status, true, out var to)) return Errors.Validation("Okänd status.");
        var p = await _creators.Query().Include(x => x.CreatorProfile).ThenInclude(c => c.User)
            .Include(x => x.CreatorProfile).ThenInclude(c => c.TikTokAccount)
            .FirstOrDefaultAsync(x => x.CreatorProfileId == creatorProfileId, ct);
        if (p == null) return Errors.NotFound("Creator", creatorProfileId);

        var now = DateTime.UtcNow;
        p.Status = to;
        p.StatusNote = string.IsNullOrWhiteSpace(r.Note) ? null : r.Note.Trim();
        p.ReviewedBy = adminUserId;
        p.ReviewedAt = now;
        p.SuspendedAt = to == UgcCreatorStatus.Suspended ? now : null;
        if (to != UgcCreatorStatus.Suspended && p.Strikes >= _settings.StrikesToSuspend) p.Strikes = 0;   // an admin lifting a ban resets the count
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(adminUserId, "Ugc.CreatorStatus", "UgcCreatorProfile", p.Id);

        var msg = to switch
        {
            UgcCreatorStatus.Approved => "Din profil är godkänd på marknadsplatsen — du kan nu lägga bud på videouppdrag.",
            UgcCreatorStatus.Suspended => "Ditt konto på marknadsplatsen har stängts av." + (p.StatusNote != null ? $" Orsak: {p.StatusNote}" : ""),
            UgcCreatorStatus.Verified => "Din profil är verifierad på marknadsplatsen.",
            _ => "Din profil på marknadsplatsen väntar på granskning.",
        };
        await Notify(p.CreatorProfile.UserId, NotificationType.SystemMessage, msg, null);
        return Row(p);
    }

    public async Task<Result<List<UgcAdminDisputeRowDto>>> ListDisputesAsync(bool openOnly, CancellationToken ct = default)
    {
        var q = _disputes.Query().Include(d => d.Collab).ThenInclude(c => c.BrandProfile)
            .Include(d => d.Collab).ThenInclude(c => c.CreatorProfile)
            .Include(d => d.Collab).ThenInclude(c => c.Payment).AsQueryable();
        if (openOnly) q = q.Where(d => d.Status == UgcDisputeStatus.Open);
        var rows = await q.OrderBy(d => d.Status).ThenBy(d => d.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(Row).ToList();
    }

    public async Task<Result<UgcAdminDisputeRowDto>> ResolveDisputeAsync(Guid adminUserId, Guid disputeId, ResolveUgcDisputeRequest r, CancellationToken ct = default)
    {
        if (!Enum.TryParse<UgcDisputeDecision>(r.Decision, true, out var decision)) return Errors.Validation("Okänt beslut.");
        var reasoning = (r.Reasoning ?? "").Trim();
        if (reasoning.Length < 20) return Errors.Validation("Motivera beslutet (minst 20 tecken) — det loggas och visas för båda parter.");
        if (decision == UgcDisputeDecision.Split && r.CreatorSharePercent is not (> 0 and < 100))
            return Errors.Validation("Ange creatorns andel i procent (1–99) för en delning.");

        var d = await _disputes.Query()
            .Include(x => x.Collab).ThenInclude(c => c.BrandProfile)
            .Include(x => x.Collab).ThenInclude(c => c.CreatorProfile)
            .Include(x => x.Collab).ThenInclude(c => c.Payment)
            .Include(x => x.Collab).ThenInclude(c => c.Deliverables)
            .FirstOrDefaultAsync(x => x.Id == disputeId, ct);
        if (d == null) return Errors.NotFound("Dispute", disputeId);
        if (d.Status != UgcDisputeStatus.Open) return Errors.Conflict("Tvisten är redan avgjord.");
        var collab = d.Collab;
        collab.Dispute = d;
        if (collab.Status != UgcCollabStatus.Disputed) return Errors.Conflict($"Uppdraget är i läget {collab.Status}, inte Disputed.");

        var now = DateTime.UtcNow;
        d.Status = UgcDisputeStatus.Resolved;
        d.Decision = decision;
        d.CreatorSharePercent = decision == UgcDisputeDecision.Split ? r.CreatorSharePercent : null;
        d.AdminReasoning = reasoning;
        d.ResolvedBy = adminUserId;
        d.ResolvedAt = now;

        var ctx = UgcTransitionContext.From(collab, UgcMapper.IsFunded(collab), _settings.AutoApproveDays, _settings.RevisionDeadlineDays)
            with { DisputeOpen = false };
        var creator = await _creators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == collab.CreatorProfileId, ct)
                      ?? new UgcCreatorProfile { CreatorProfileId = collab.CreatorProfileId };

        switch (decision)
        {
            case UgcDisputeDecision.PayCreator:
                _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Approved, UgcActor.Admin, now, ctx, adminUserId, $"Tvist avgjord: creatorn får betalt. {reasoning}"));
                UgcSettlementService.RecordDelivery(collab, creator);
                await _settlement.TrySettleApprovedAsync(collab, creator, _settings, now, ct);
                break;

            case UgcDisputeDecision.RefundBrand:
                _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Cancelled, UgcActor.Admin, now, ctx, adminUserId, $"Tvist avgjord: företaget återbetalas. {reasoning}"));
                await _settlement.TryRefundAsync(collab, now, ct);
                break;

            case UgcDisputeDecision.Split:
                _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Approved, UgcActor.Admin, now, ctx, adminUserId, $"Tvist avgjord: delning {r.CreatorSharePercent} % till creatorn. {reasoning}"));
                UgcSettlementService.RecordDelivery(collab, creator);
                await _settlement.TrySettleSplitAsync(collab, creator, r.CreatorSharePercent!.Value, _settings, now, ct);
                break;
        }
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(adminUserId, "Ugc.DisputeResolved", "UgcDispute", d.Id);

        var outcome = decision switch
        {
            UgcDisputeDecision.PayCreator => "creatorn får hela ersättningen",
            UgcDisputeDecision.RefundBrand => "företaget återbetalas i sin helhet",
            _ => $"ersättningen delas ({r.CreatorSharePercent} % till creatorn)",
        };
        await Notify(collab.BrandProfile.UserId, NotificationType.UgcDispute, $"Tvisten om \"{collab.Title}\" är avgjord: {outcome}. Motivering: {reasoning}", collab.Id);
        await Notify(collab.CreatorProfile.UserId, NotificationType.UgcDispute, $"Tvisten om \"{collab.Title}\" är avgjord: {outcome}. Motivering: {reasoning}", collab.Id);
        return Row(d);
    }

    public async Task<Result<UgcCollabDetailDto>> MarkFundedManuallyAsync(Guid adminUserId, Guid collabId, string? note, CancellationToken ct = default)
    {
        var collab = await _collabs.Query().Include(c => c.Payment).FirstOrDefaultAsync(c => c.Id == collabId, ct);
        if (collab == null) return Errors.NotFound("Collab", collabId);
        if (collab.Compensation == UgcCompensationType.ProductExchange) return Errors.Conflict("Produktbyte har ingen betalning.");
        if (UgcMapper.IsFunded(collab)) return Errors.Conflict("Betalningen är redan registrerad.");
        if (collab.BrandAcceptedAt == null) return Errors.Conflict("Företaget har inte accepterat kontraktet ännu.");

        await _webhooks.MarkHeldAsync(collabId, "manual", null, null, collab.BrandTotalOre, null,
            $"Betalning registrerad manuellt av admin. {note}".Trim(), ct);
        await _audit.LogAsync(adminUserId, "Ugc.MarkFunded", "UgcCollab", collabId);
        return await _collabService.GetAsync(adminUserId, collabId, ct);
    }

    private static UgcAdminCreatorRowDto Row(UgcCreatorProfile p) => new(
        p.CreatorProfileId, p.CreatorProfile.UserId, p.CreatorProfile.DisplayName, p.CreatorProfile.AvatarUrl, p.CreatorProfile.User.Email,
        p.CreatorProfile.TikTokAccount?.TikTokUsername, p.Status.ToString(), p.StatusNote, p.Strikes, p.FollowerSnapshot, p.LikeFollowerRatio,
        p.Categories, p.City, p.SampleVideoUrl, p.PayoutOnboardingComplete, p.DeliveredCount, p.AverageRating, p.CreatedAt);

    private static UgcAdminDisputeRowDto Row(UgcDispute d) => new(
        d.Id, d.CollabId, d.Collab.Title, d.Collab.BrandProfile.CompanyName, d.Collab.CreatorProfile.DisplayName,
        d.OpenedBy.ToString(), d.Reason, d.Status.ToString(), d.Decision?.ToString(), d.CreatorSharePercent,
        d.Collab.AgreedAmountOre, d.Collab.Payment?.BrandPaidOre ?? 0, d.CreatedAt, d.ResolvedAt);

    private async Task Notify(Guid userId, NotificationType type, string message, Guid? refId)
    {
        try { await _notify.SendAsync(userId, type, message, refId); }
        catch (Exception ex) { _logger.LogWarning(ex, "UGC notification failed for {User}", userId); }
    }
}
