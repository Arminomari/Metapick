namespace CreatorPay.Domain.Common;

/// <summary>
/// One place for the "unreviewed videos are approved automatically" window.
/// The job, the DTOs and the UI all read it from here instead of repeating 48.
/// </summary>
public static class ReviewPolicy
{
    public const int DefaultAutoApproveHours = 48;

    public static DateTime AutoApproveAt(DateTime submittedAtUtc, int hours = DefaultAutoApproveHours)
        => submittedAtUtc.AddHours(hours);

    public static int HoursUntilAutoApprove(DateTime submittedAtUtc, DateTime nowUtc, int hours = DefaultAutoApproveHours)
        => Math.Max(0, (int)Math.Ceiling((AutoApproveAt(submittedAtUtc, hours) - nowUtc).TotalHours));
}

/// <summary>
/// Tracking-link clicks: one visitor (same IP hash) counts once per link per
/// window. Every hit is still logged; only the counter is protected.
/// </summary>
public static class ClickPolicy
{
    public static readonly TimeSpan DedupeWindow = TimeSpan.FromHours(24);

    public static bool ShouldCount(DateTime? lastClickFromSameVisitorUtc, DateTime nowUtc)
        => lastClickFromSameVisitorUtc == null || nowUtc - lastClickFromSameVisitorUtc.Value >= DedupeWindow;
}
