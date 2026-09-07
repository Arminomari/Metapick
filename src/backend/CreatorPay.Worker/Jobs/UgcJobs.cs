using CreatorPay.Application.Interfaces;
using CreatorPay.Application.Ugc;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Domain.Ugc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Worker.Jobs;

/// <summary>
/// Deadlines: reminders 48 h and 24 h before, and the no-show rule when the
/// clock runs out (cancel, full refund, strike). Runs hourly. Every step is
/// decided from timestamps and markers on the row, so running it twice — or
/// after an outage — changes nothing that already happened.
/// </summary>
public class UgcDeadlineJob
{
    private readonly ILogger<UgcDeadlineJob> _logger;
    private readonly IRepository<UgcCollab> _collabs;
    private readonly IRepository<UgcCreatorProfile> _creators;
    private readonly IRepository<UgcCollabEvent> _events;
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notifications;
    private readonly UgcSettlementService _settlement;
    private readonly UgcSettings _settings;

    public UgcDeadlineJob(ILogger<UgcDeadlineJob> logger, IRepository<UgcCollab> collabs,
        IRepository<UgcCreatorProfile> creators, IRepository<UgcCollabEvent> events, IUnitOfWork uow,
        INotificationService notifications, UgcSettlementService settlement, UgcSettings settings)
    {
        _logger = logger;
        _collabs = collabs;
        _creators = creators;
        _events = events;
        _uow = uow;
        _notifications = notifications;
        _settlement = settlement;
        _settings = settings;
    }

    public Task ExecuteAsync() => ExecuteAsync(DateTime.UtcNow, CancellationToken.None);

    public async Task ExecuteAsync(DateTime now, CancellationToken ct)
    {
        var horizon = now.AddHours(48);
        var candidates = await _collabs.Query()
            .Include(c => c.Payment)
            .Include(c => c.BrandProfile)
            .Include(c => c.CreatorProfile)
            .Where(c => (c.Status == UgcCollabStatus.Accepted
                         || c.Status == UgcCollabStatus.InProgress
                         || c.Status == UgcCollabStatus.RevisionRequested)
                        && c.DeadlineAt != null && c.DeadlineAt <= horizon)
            .ToListAsync(ct);

        var noShows = 0; var reminders = 0;
        foreach (var collab in candidates)
        {
            try
            {
                if (UgcSchedule.IsNoShow(collab, now))
                {
                    await HandleNoShowAsync(collab, now, ct);
                    noShows++;
                }
                else
                {
                    reminders += await SendRemindersAsync(collab, now);
                }
                await _uow.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                // One bad row must not stop the rest; it is picked up next hour.
                _logger.LogError(ex, "UgcDeadlineJob failed for collab {Id}", collab.Id);
            }
        }

        _logger.LogInformation("UgcDeadlineJob: {Candidates} checked, {NoShows} no-shows, {Reminders} reminders", candidates.Count, noShows, reminders);
    }

    private async Task HandleNoShowAsync(UgcCollab collab, DateTime now, CancellationToken ct)
    {
        var ctx = UgcTransitionContext.From(collab, funded: collab.Payment?.Status == UgcPaymentStatus.Held,
            _settings.AutoApproveDays, _settings.RevisionDeadlineDays);
        collab.NoShow = true;
        _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Cancelled, UgcActor.System, now, ctx,
            note: "Deadline passerad utan leverans."));

        // The strike lands on the marketplace profile, never on the core account.
        var creator = await _creators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == collab.CreatorProfileId, ct);
        var suspended = creator != null && UgcSettlementService.AddStrike(creator, _settings.Thresholds, now);

        // Money back to the brand. If the provider is not reachable the collab is
        // still cancelled; the payment row keeps the reason and phase 2's
        // reconciliation retries the refund.
        await _settlement.TryRefundAsync(collab, now, ct);

        await Notify(collab.CreatorProfile.UserId, NotificationType.UgcCancelled,
            $"Uppdraget \"{collab.Title}\" avbröts: deadline passerade utan leverans. Du har nu {creator?.Strikes ?? 0} anmärkning(ar)." +
            (suspended ? " Ditt konto på marknadsplatsen är avstängt." : ""), collab.Id);
        await Notify(collab.BrandProfile.UserId, NotificationType.UgcCancelled,
            $"Creatorn levererade inte \"{collab.Title}\" i tid. Uppdraget är avbrutet och hela beloppet återbetalas.", collab.Id);
    }

    private async Task<int> SendRemindersAsync(UgcCollab collab, DateTime now)
    {
        var sent = 0;
        foreach (var kind in UgcSchedule.DueReminders(collab, now))
        {
            switch (kind)
            {
                case UgcReminderKind.Deadline48h:
                    await Notify(collab.CreatorProfile.UserId, NotificationType.UgcDeadlineReminder,
                        $"48 timmar kvar: \"{collab.Title}\" ska levereras senast {collab.DeadlineAt:yyyy-MM-dd HH:mm} UTC.", collab.Id);
                    collab.DeadlineReminder48hSentAt = now;
                    sent++;
                    break;
                case UgcReminderKind.Deadline24h:
                    await Notify(collab.CreatorProfile.UserId, NotificationType.UgcDeadlineReminder,
                        $"24 timmar kvar: \"{collab.Title}\" ska levereras senast {collab.DeadlineAt:yyyy-MM-dd HH:mm} UTC. Uteblir leveransen avbryts uppdraget.", collab.Id);
                    collab.DeadlineReminder24hSentAt = now;
                    sent++;
                    break;
            }
        }
        return sent;
    }

    private async Task Notify(Guid userId, NotificationType type, string message, Guid refId)
    {
        try { await _notifications.SendAsync(userId, type, message, refId); }
        catch (Exception ex) { _logger.LogWarning(ex, "UGC notification failed for {User}", userId); }
    }
}

/// <summary>
/// Silence is consent: a submitted delivery the brand has not answered within
/// the review window is approved, and the creator is paid. Also sends the
/// "24 h left to review" nudge. Hourly; idempotent by construction.
/// </summary>
public class UgcAutoApproveJob
{
    private readonly ILogger<UgcAutoApproveJob> _logger;
    private readonly IRepository<UgcCollab> _collabs;
    private readonly IRepository<UgcCreatorProfile> _creators;
    private readonly IRepository<UgcCollabEvent> _events;
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notifications;
    private readonly UgcSettlementService _settlement;
    private readonly UgcSettings _settings;

    public UgcAutoApproveJob(ILogger<UgcAutoApproveJob> logger, IRepository<UgcCollab> collabs,
        IRepository<UgcCreatorProfile> creators, IRepository<UgcCollabEvent> events, IUnitOfWork uow,
        INotificationService notifications, UgcSettlementService settlement, UgcSettings settings)
    {
        _logger = logger;
        _collabs = collabs;
        _creators = creators;
        _events = events;
        _uow = uow;
        _notifications = notifications;
        _settlement = settlement;
        _settings = settings;
    }

    public Task ExecuteAsync() => ExecuteAsync(DateTime.UtcNow, CancellationToken.None);

    public async Task ExecuteAsync(DateTime now, CancellationToken ct)
    {
        var horizon = now.AddHours(24);

        // Two populations: submitted work whose clock is near or past, and
        // approved work whose transfer did not go through last time.
        var candidates = await _collabs.Query()
            .Include(c => c.Payment)
            .Include(c => c.Dispute)
            .Include(c => c.BrandProfile)
            .Include(c => c.CreatorProfile)
            .Where(c => (c.Status == UgcCollabStatus.Submitted && c.AutoApproveAt != null && c.AutoApproveAt <= horizon)
                        || c.Status == UgcCollabStatus.Approved)
            .ToListAsync(ct);

        var approved = 0; var paid = 0; var reminders = 0;
        foreach (var collab in candidates)
        {
            try
            {
                var creator = await _creators.Query().FirstOrDefaultAsync(p => p.CreatorProfileId == collab.CreatorProfileId, ct)
                              ?? new UgcCreatorProfile { CreatorProfileId = collab.CreatorProfileId };

                if (collab.Status == UgcCollabStatus.Submitted && UgcSchedule.IsAutoApproveDue(collab, now))
                {
                    var ctx = UgcTransitionContext.From(collab, funded: collab.Payment?.Status == UgcPaymentStatus.Held,
                        _settings.AutoApproveDays, _settings.RevisionDeadlineDays);
                    _events.Add(UgcCollabStateMachine.Apply(collab, UgcCollabStatus.Approved, UgcActor.System, now, ctx,
                        note: "Godkänd automatiskt — granskningstiden gick ut."));
                    UgcSettlementService.RecordDelivery(collab, creator);
                    approved++;

                    await Notify(collab.BrandProfile.UserId, NotificationType.UgcApproved,
                        $"\"{collab.Title}\" godkändes automatiskt eftersom granskningstiden gick ut. Videon och licensbeviset finns under uppdraget.", collab.Id);
                    await Notify(collab.CreatorProfile.UserId, NotificationType.UgcApproved,
                        $"\"{collab.Title}\" är godkänd. Utbetalningen är på väg.", collab.Id);
                }
                else if (collab.Status == UgcCollabStatus.Submitted)
                {
                    if (UgcSchedule.DueReminders(collab, now).Contains(UgcReminderKind.AutoApprove24h))
                    {
                        await Notify(collab.BrandProfile.UserId, NotificationType.UgcAutoApproveReminder,
                            $"24 timmar kvar att granska \"{collab.Title}\". Utan svar godkänns leveransen automatiskt {collab.AutoApproveAt:yyyy-MM-dd HH:mm} UTC.", collab.Id);
                        collab.AutoApproveReminderSentAt = now;
                        reminders++;
                    }
                }

                if (collab.Status == UgcCollabStatus.Approved
                    && await _settlement.TrySettleApprovedAsync(collab, creator, _settings, now, ct))
                {
                    paid++;
                    await Notify(collab.CreatorProfile.UserId, NotificationType.UgcPaid,
                        $"Utbetalningen för \"{collab.Title}\" är genomförd.", collab.Id);
                }

                await _uow.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UgcAutoApproveJob failed for collab {Id}", collab.Id);
            }
        }

        _logger.LogInformation("UgcAutoApproveJob: {Candidates} checked, {Approved} auto-approved, {Paid} paid, {Reminders} reminders",
            candidates.Count, approved, paid, reminders);
    }

    private async Task Notify(Guid userId, NotificationType type, string message, Guid refId)
    {
        try { await _notifications.SendAsync(userId, type, message, refId); }
        catch (Exception ex) { _logger.LogWarning(ex, "UGC notification failed for {User}", userId); }
    }
}
