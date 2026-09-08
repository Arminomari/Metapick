using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Domain.Ugc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Ugc;

public interface IUgcWebhookService
{
    /// <summary>
    /// Run <paramref name="handler"/> exactly once for this provider event id.
    /// Returns false when the event was already seen. If the handler throws,
    /// the claim is released so the provider's retry gets another chance.
    /// </summary>
    Task<bool> ProcessOnceAsync(string provider, string eventId, string eventType, Func<CancellationToken, Task> handler, CancellationToken ct = default);

    /// <summary>The brand's money is on the platform account. Moves Invited → Accepted when the creator has already signed.</summary>
    Task MarkHeldAsync(Guid collabId, string provider, string? paymentIntentId, string? chargeId, long amountOre, string? checkoutSessionId, string? note, CancellationToken ct = default);

    Task MarkRefundedAsync(string paymentIntentId, long refundedOre, string? refundId, CancellationToken ct = default);
    Task UpdateConnectAccountAsync(string accountId, bool detailsSubmitted, bool payoutsEnabled, CancellationToken ct = default);
}

/// <summary>
/// Provider-agnostic webhook handling. Stripe parsing lives in the API
/// controller; the decisions live here so they can be tested with plain
/// values. Idempotency: the (provider, event id) row is the lock.
/// </summary>
public sealed class UgcWebhookService : IUgcWebhookService
{
    private readonly IRepository<UgcWebhookEvent> _events;
    private readonly IRepository<UgcCollab> _collabs;
    private readonly IRepository<UgcPayment> _payments;
    private readonly IRepository<UgcCollabEvent> _collabEvents;
    private readonly IRepository<UgcCreatorProfile> _creators;
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notify;
    private readonly IUgcPaymentGateway _gateway;
    private readonly UgcSettings _settings;
    private readonly ILogger<UgcWebhookService> _logger;

    public UgcWebhookService(IRepository<UgcWebhookEvent> events, IRepository<UgcCollab> collabs, IRepository<UgcPayment> payments,
        IRepository<UgcCollabEvent> collabEvents, IRepository<UgcCreatorProfile> creators, IUnitOfWork uow,
        INotificationService notify, IUgcPaymentGateway gateway, UgcSettings settings, ILogger<UgcWebhookService> logger)
    {
        _events = events; _collabs = collabs; _payments = payments; _collabEvents = collabEvents; _creators = creators;
        _uow = uow; _notify = notify; _gateway = gateway; _settings = settings; _logger = logger;
    }

    public async Task<bool> ProcessOnceAsync(string provider, string eventId, string eventType, Func<CancellationToken, Task> handler, CancellationToken ct = default)
    {
        if (await _events.Query().AnyAsync(e => e.Provider == provider && e.EventId == eventId, ct))
        {
            _logger.LogInformation("Webhook {Provider}/{EventId} already processed — ignored", provider, eventId);
            return false;
        }

        var row = new UgcWebhookEvent { Provider = provider, EventId = eventId, EventType = eventType, ReceivedAt = DateTime.UtcNow };
        _events.Add(row);
        try
        {
            await _uow.SaveChangesAsync(ct);            // claim — a concurrent duplicate fails here
        }
        catch (DbUpdateException)
        {
            _logger.LogInformation("Webhook {Provider}/{EventId} claimed concurrently — ignored", provider, eventId);
            return false;
        }

        try
        {
            await handler(ct);
            row.ProcessedAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            // Release the claim so the provider's retry is not silently swallowed.
            _logger.LogError(ex, "Webhook {Provider}/{EventId} ({Type}) failed; claim released", provider, eventId, eventType);
            row.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
            _events.Remove(row);
            await _uow.SaveChangesAsync(ct);
            throw;
        }
    }

    public async Task MarkHeldAsync(Guid collabId, string provider, string? paymentIntentId, string? chargeId, long amountOre, string? checkoutSessionId, string? note, CancellationToken ct = default)
    {
        var collab = await _collabs.Query()
            .Include(c => c.Payment).Include(c => c.Dispute).Include(c => c.BrandProfile).Include(c => c.CreatorProfile)
            .FirstOrDefaultAsync(c => c.Id == collabId, ct);
        if (collab == null)
        {
            _logger.LogWarning("Payment for unknown collab {Id} — refunding if possible", collabId);
            if (paymentIntentId != null && _gateway.IsConfigured) await _gateway.RefundAsync(collabId, paymentIntentId, amountOre, ct);
            return;
        }

        var payment = collab.Payment;
        if (payment == null)
        {
            payment = new UgcPayment { CollabId = collab.Id, CreatorAmountOre = collab.AgreedAmountOre, PlatformFeeOre = collab.PlatformFeeOre };
            _payments.Add(payment);
            collab.Payment = payment;
        }

        if (payment.Status is UgcPaymentStatus.Held or UgcPaymentStatus.Transferred or UgcPaymentStatus.PartiallyRefunded)
        {
            if (paymentIntentId != null && payment.PaymentIntentId != null && payment.PaymentIntentId != paymentIntentId)
            {
                // Paid twice (two checkout tabs). Keep the first, give the second back.
                _logger.LogWarning("Collab {Id} paid twice ({A} then {B}); refunding the second", collab.Id, payment.PaymentIntentId, paymentIntentId);
                if (_gateway.IsConfigured) await _gateway.RefundAsync(collab.Id, paymentIntentId, amountOre, ct);
            }
            return;                                                   // already held — idempotent
        }

        if (collab.Status is UgcCollabStatus.Cancelled or UgcCollabStatus.Paid)
        {
            // Money arrived for a job that no longer exists — straight back.
            _logger.LogWarning("Payment arrived for {Status} collab {Id}; refunding", collab.Status, collab.Id);
            if (paymentIntentId != null && _gateway.IsConfigured) await _gateway.RefundAsync(collab.Id, paymentIntentId, amountOre, ct);
            return;
        }

        var now = DateTime.UtcNow;
        payment.Provider = provider;
        payment.PaymentIntentId = paymentIntentId ?? payment.PaymentIntentId;
        payment.ChargeId = chargeId ?? payment.ChargeId;
        payment.CheckoutSessionId = checkoutSessionId ?? payment.CheckoutSessionId;
        payment.BrandPaidOre = amountOre > 0 ? amountOre : collab.BrandTotalOre;
        payment.Status = UgcPaymentStatus.Held;
        payment.HeldAt = now;
        payment.LastError = null;
        _collabEvents.Add(new UgcCollabEvent { CollabId = collab.Id, FromStatus = collab.Status, ToStatus = collab.Status, Actor = UgcActor.System, Note = note ?? $"Betalning mottagen ({UgcFeeCalculator.FormatSek(payment.BrandPaidOre)})." });

        if (collab.Status == UgcCollabStatus.Invited && collab.BrandAcceptedAt != null && collab.CreatorAcceptedAt != null)
        {
            var ctx = UgcTransitionContext.From(collab, funded: true, _settings.AutoApproveDays, _settings.RevisionDeadlineDays);
            if (UgcCollabStateMachine.Check(collab.Status, UgcCollabStatus.Accepted, UgcActor.System, ctx).Allowed)
            {
                _collabEvents.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Accepted, UgcActor.System, now, ctx, note: "Betalning mottagen — båda parter har accepterat."));
                await Notify(collab.CreatorProfile.UserId, NotificationType.UgcContractAccepted, $"Avtalet för \"{collab.Title}\" gäller. Leverera senast {collab.DeadlineAt:yyyy-MM-dd}.", collab.Id);
            }
        }
        else if (collab.Status == UgcCollabStatus.Invited)
        {
            await Notify(collab.CreatorProfile.UserId, NotificationType.UgcContractAccepted,
                $"{collab.BrandProfile.CompanyName} har betalat för \"{collab.Title}\". Din tur att acceptera kontraktet.", collab.Id);
        }
        await Notify(collab.BrandProfile.UserId, NotificationType.UgcContractAccepted,
            $"Betalningen för \"{collab.Title}\" är mottagen ({UgcFeeCalculator.FormatSek(payment.BrandPaidOre)}). Beloppet hålls tills leveransen är godkänd.", collab.Id);

        await _uow.SaveChangesAsync(ct);
    }

    public async Task MarkRefundedAsync(string paymentIntentId, long refundedOre, string? refundId, CancellationToken ct = default)
    {
        var payment = await _payments.Query().FirstOrDefaultAsync(p => p.PaymentIntentId == paymentIntentId, ct);
        if (payment == null) return;
        if (payment.Status == UgcPaymentStatus.Refunded) return;
        payment.RefundId ??= refundId;
        payment.RefundedOre = Math.Max(payment.RefundedOre, refundedOre);
        payment.RefundedAt ??= DateTime.UtcNow;
        payment.Status = payment.RefundedOre >= payment.BrandPaidOre ? UgcPaymentStatus.Refunded
            : payment.TransferredOre > 0 ? UgcPaymentStatus.PartiallyRefunded : payment.Status;
        await _uow.SaveChangesAsync(ct);
    }

    public async Task UpdateConnectAccountAsync(string accountId, bool detailsSubmitted, bool payoutsEnabled, CancellationToken ct = default)
    {
        var p = await _creators.Query().Include(x => x.CreatorProfile).FirstOrDefaultAsync(x => x.StripeConnectAccountId == accountId, ct);
        if (p == null) return;
        var ready = detailsSubmitted && payoutsEnabled;
        if (p.PayoutOnboardingComplete == ready) return;
        p.PayoutOnboardingComplete = ready;
        await _uow.SaveChangesAsync(ct);
        if (ready)
            await Notify(p.CreatorProfile.UserId, NotificationType.SystemMessage, "Din utbetalningsregistrering är klar — du kan nu ta betalda videouppdrag.", null);
    }

    private async Task Notify(Guid userId, NotificationType type, string message, Guid? refId)
    {
        try { await _notify.SendAsync(userId, type, message, refId); }
        catch (Exception ex) { _logger.LogWarning(ex, "UGC notification failed for {User}", userId); }
    }
}
