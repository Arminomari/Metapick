using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Ugc;

public enum UgcReminderKind
{
    Deadline48h,
    Deadline24h,
    AutoApprove24h,
}

/// <summary>
/// Every clock in the marketplace, as pure functions of "now". The jobs ask
/// these questions; the answers never depend on when the job happens to run,
/// which is what makes re-running a job safe.
/// </summary>
public static class UgcSchedule
{
    public const int DefaultAutoApproveDays = 5;
    public const int DefaultRevisionDeadlineDays = 3;

    public static DateTime DeadlineFromAcceptance(DateTime acceptedAt, int deadlineDays)
        => acceptedAt.AddDays(Math.Max(1, deadlineDays));

    public static DateTime AutoApproveAt(DateTime submittedAt, int autoApproveDays = DefaultAutoApproveDays)
        => submittedAt.AddDays(Math.Max(1, autoApproveDays));

    public static DateTime RevisionDeadline(DateTime requestedAt, int revisionDeadlineDays = DefaultRevisionDeadlineDays)
        => requestedAt.AddDays(Math.Max(1, revisionDeadlineDays));

    /// <summary>States in which a missed deadline is the creator's no-show.</summary>
    public static bool AwaitsDelivery(UgcCollabStatus s)
        => s is UgcCollabStatus.Accepted or UgcCollabStatus.InProgress or UgcCollabStatus.RevisionRequested;

    /// <summary>Deadline passed with nothing delivered.</summary>
    public static bool IsNoShow(UgcCollab c, DateTime now)
        => AwaitsDelivery(c.Status) && c.DeadlineAt.HasValue && c.DeadlineAt.Value < now;

    /// <summary>Submitted, clock ran out, no dispute freezing it.</summary>
    public static bool IsAutoApproveDue(UgcCollab c, DateTime now)
        => c.Status == UgcCollabStatus.Submitted
           && c.AutoApproveAt.HasValue
           && c.AutoApproveAt.Value <= now
           && c.Dispute?.Status != UgcDisputeStatus.Open;

    /// <summary>
    /// Which reminders are due right now and not yet sent. A reminder is due
    /// from its window opening until the event itself; once the event has
    /// passed it is pointless and is never sent late.
    /// </summary>
    public static IReadOnlyList<UgcReminderKind> DueReminders(UgcCollab c, DateTime now)
    {
        var due = new List<UgcReminderKind>(2);

        if (AwaitsDelivery(c.Status) && c.DeadlineAt is { } deadline && deadline > now)
        {
            var left = deadline - now;
            if (left <= TimeSpan.FromHours(48) && c.DeadlineReminder48hSentAt == null)
                due.Add(UgcReminderKind.Deadline48h);
            if (left <= TimeSpan.FromHours(24) && c.DeadlineReminder24hSentAt == null)
                due.Add(UgcReminderKind.Deadline24h);
        }

        if (c.Status == UgcCollabStatus.Submitted && c.AutoApproveAt is { } auto && auto > now
            && c.Dispute?.Status != UgcDisputeStatus.Open
            && auto - now <= TimeSpan.FromHours(24)
            && c.AutoApproveReminderSentAt == null)
            due.Add(UgcReminderKind.AutoApprove24h);

        return due;
    }

    /// <summary>Delivered on or before the clock — feeds the creator's track record.</summary>
    public static bool WasOnTime(UgcCollab c)
        => c.SubmittedAt.HasValue && c.DeadlineAt.HasValue && c.SubmittedAt.Value <= c.DeadlineAt.Value;
}
