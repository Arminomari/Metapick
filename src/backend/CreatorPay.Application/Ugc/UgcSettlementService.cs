using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Domain.Ugc;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Ugc;

/// <summary>
/// The money moves that follow a status change. Used by the jobs (auto-approve,
/// no-show) and, in phase 3, by the same buttons in the UI — one path for
/// "approved → creator paid" and one for "cancelled → brand refunded".
/// Every method is safe to call again: it looks at the payment row first.
/// </summary>
public sealed class UgcSettlementService
{
    private readonly IUgcPaymentGateway _gateway;
    private readonly IRepository<UgcPayment> _payments;
    private readonly IRepository<UgcCollabEvent> _events;
    private readonly ILogger<UgcSettlementService> _logger;

    public UgcSettlementService(IUgcPaymentGateway gateway, IRepository<UgcPayment> payments,
        IRepository<UgcCollabEvent> events, ILogger<UgcSettlementService> logger)
    {
        _gateway = gateway;
        _payments = payments;
        _events = events;
        _logger = logger;
    }

    /// <summary>
    /// Approved → Paid. Product exchange settles instantly; paid work needs a
    /// transfer to the creator's connected account. When the transfer cannot
    /// happen yet (no provider, no connected account) the collab stays Approved
    /// with the reason on the payment row, and the next run tries again.
    /// </summary>
    public async Task<bool> TrySettleApprovedAsync(UgcCollab collab, UgcCreatorProfile creator, UgcSettings settings, DateTime now, CancellationToken ct = default)
    {
        if (collab.Status != UgcCollabStatus.Approved) return collab.Status == UgcCollabStatus.Paid;
        var ctx = UgcTransitionContext.From(collab, funded: true, settings.AutoApproveDays, settings.RevisionDeadlineDays);

        if (collab.Compensation == UgcCompensationType.ProductExchange)
        {
            if (collab.Payment == null)
            {
                collab.Payment = new UgcPayment { CollabId = collab.Id };
                _payments.Add(collab.Payment);
            }
            collab.Payment.Status = UgcPaymentStatus.NotApplicable;
            _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Paid, UgcActor.System, now, ctx, note: "Produktbyte — ingen utbetalning."));
            return true;
        }

        var payment = collab.Payment;
        if (payment == null)
        {
            _logger.LogWarning("UGC collab {Id} approved but has no payment row", collab.Id);
            return false;
        }

        if (payment.Status == UgcPaymentStatus.Transferred)
        {
            // Transfer already happened (webhook or earlier run); just close the loop.
            _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Paid, UgcActor.System, now, ctx, note: "Utbetald."));
            return true;
        }

        if (payment.Status != UgcPaymentStatus.Held || string.IsNullOrEmpty(payment.ChargeId))
        {
            payment.LastError = "Inga pengar hålls för uppdraget — kan inte betala ut.";
            return false;
        }

        if (string.IsNullOrEmpty(creator.StripeConnectAccountId))
        {
            payment.LastError = "Creatorn har inte slutfört utbetalningsregistreringen.";
            return false;
        }

        var amount = collab.AgreedAmountOre;
        var result = await _gateway.TransferAsync(collab.Id, payment.ChargeId, amount, payment.Currency, creator.StripeConnectAccountId, ct);
        if (!result.Success)
        {
            payment.LastError = result.Error;
            _logger.LogWarning("UGC transfer failed for collab {Id}: {Error}", collab.Id, result.Error);
            return false;
        }

        payment.TransferId = result.ExternalId;
        payment.TransferredOre = amount;
        payment.TransferredAt = now;
        payment.Status = UgcPaymentStatus.Transferred;
        payment.LastError = null;
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Paid, UgcActor.System, now, ctx, note: "Utbetald."));
        return true;
    }

    /// <summary>
    /// Give the brand its money back after a cancellation. Full refund includes
    /// Vyrle's fee — nothing was delivered, so nothing was earned.
    /// </summary>
    public async Task<bool> TryRefundAsync(UgcCollab collab, DateTime now, CancellationToken ct = default)
    {
        var payment = collab.Payment;
        if (payment == null) return true;                                    // nothing was ever charged
        if (payment.Status is UgcPaymentStatus.Refunded or UgcPaymentStatus.NotApplicable or UgcPaymentStatus.Pending) return true;
        if (payment.Status != UgcPaymentStatus.Held || string.IsNullOrEmpty(payment.PaymentIntentId))
        {
            payment.LastError = $"Kan inte återbetala i läget {payment.Status}.";
            return false;
        }

        var result = await _gateway.RefundAsync(collab.Id, payment.PaymentIntentId, payment.BrandPaidOre, ct);
        if (!result.Success)
        {
            payment.LastError = result.Error;
            _logger.LogWarning("UGC refund failed for collab {Id}: {Error}", collab.Id, result.Error);
            return false;
        }

        payment.RefundId = result.ExternalId;
        payment.RefundedOre = payment.BrandPaidOre;
        payment.RefundedAt = now;
        payment.Status = UgcPaymentStatus.Refunded;
        payment.LastError = null;
        return true;
    }

    /// <summary>
    /// Dispute split: the creator's share is transferred, the rest of the
    /// agreed amount goes back to the brand. Vyrle's fee stays — the platform
    /// did its job. Ends in Paid with the payment marked PartiallyRefunded.
    /// </summary>
    public async Task<bool> TrySettleSplitAsync(UgcCollab collab, UgcCreatorProfile creator, int creatorSharePercent, UgcSettings settings, DateTime now, CancellationToken ct = default)
    {
        if (collab.Status != UgcCollabStatus.Approved) return collab.Status == UgcCollabStatus.Paid;
        var ctx = UgcTransitionContext.From(collab, funded: true, settings.AutoApproveDays, settings.RevisionDeadlineDays);
        var split = UgcFeeCalculator.SplitAgreed(collab.AgreedAmountOre, creatorSharePercent);

        if (collab.Compensation == UgcCompensationType.ProductExchange)
        {
            if (collab.Payment == null) { collab.Payment = new UgcPayment { CollabId = collab.Id }; _payments.Add(collab.Payment); }
            collab.Payment.Status = UgcPaymentStatus.NotApplicable;
            _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Paid, UgcActor.System, now, ctx, note: "Produktbyte — delning utan pengar."));
            return true;
        }

        var payment = collab.Payment;
        if (payment == null || payment.Status != UgcPaymentStatus.Held || string.IsNullOrEmpty(payment.ChargeId) || string.IsNullOrEmpty(payment.PaymentIntentId))
        {
            if (payment != null) payment.LastError = "Inga pengar hålls för uppdraget — kan inte dela.";
            return false;
        }
        if (string.IsNullOrEmpty(creator.StripeConnectAccountId))
        {
            payment.LastError = "Creatorn har inte slutfört utbetalningsregistreringen.";
            return false;
        }

        if (split.ToCreatorOre > 0 && payment.TransferredOre == 0)
        {
            var t = await _gateway.TransferAsync(collab.Id, payment.ChargeId, split.ToCreatorOre, payment.Currency, creator.StripeConnectAccountId, ct);
            if (!t.Success) { payment.LastError = t.Error; return false; }
            payment.TransferId = t.ExternalId;
            payment.TransferredOre = split.ToCreatorOre;
            payment.TransferredAt = now;
        }
        if (split.ToBrandOre > 0 && payment.RefundedOre == 0)
        {
            var r = await _gateway.RefundAsync(collab.Id, payment.PaymentIntentId, split.ToBrandOre, ct);
            if (!r.Success) { payment.LastError = r.Error; return false; }
            payment.RefundId = r.ExternalId;
            payment.RefundedOre = split.ToBrandOre;
            payment.RefundedAt = now;
        }

        payment.Status = UgcPaymentStatus.PartiallyRefunded;
        payment.LastError = null;
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Paid, UgcActor.System, now, ctx,
            note: $"Delning: {UgcFeeCalculator.FormatSek(split.ToCreatorOre)} till creatorn, {UgcFeeCalculator.FormatSek(split.ToBrandOre)} åter till företaget."));
        return true;
    }

    /// <summary>Approved delivery feeds the creator's track record exactly once.</summary>
    public static void RecordDelivery(UgcCollab collab, UgcCreatorProfile creator)
    {
        creator.DeliveredCount += 1;
        if (UgcSchedule.WasOnTime(collab)) creator.OnTimeCount += 1; else creator.LateCount += 1;
    }

    /// <summary>A no-show costs a strike; three and the creator is out.</summary>
    public static bool AddStrike(UgcCreatorProfile creator, UgcVerificationThresholds thresholds, DateTime now)
    {
        creator.Strikes += 1;
        if (UgcVerificationRule.ShouldSuspend(creator.Strikes, thresholds) && creator.Status != UgcCreatorStatus.Suspended)
        {
            creator.Status = UgcCreatorStatus.Suspended;
            creator.SuspendedAt = now;
            creator.StatusNote = $"Automatiskt avstängd efter {creator.Strikes} uteblivna leveranser.";
            return true;
        }
        return false;
    }
}
