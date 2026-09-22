using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Common;

/// <summary>Who the work is waiting for right now. The one fact both sides need.</summary>
public enum WaitingOn { Nobody = 0, Creator = 1, Brand = 2, Vyrle = 3, TikTok = 4 }

public enum StageState { Upcoming = 0, Current = 1, Done = 2, Stopped = 3 }

/// <summary>One step in the shared timeline. Label is what both parties read.</summary>
public sealed record ProgressStage(
    string Key, string Label, StageState State, WaitingOn WaitingOn,
    string? Hint = null, DateTime? Deadline = null);

/// <summary>
/// Everything the timeline needs, already resolved by the service. Kept as a
/// flat record so the rules below stay pure and unit-testable.
/// </summary>
public sealed record AssignmentFacts(
    AssignmentStatus Status,
    bool IsTap,
    int PendingSubmissions,
    int ApprovedSubmissions,
    int RejectedSubmissions,
    DateTime? NextAutoApproveAt,
    long VerifiedViews,
    long MinViews,
    decimal CurrentPayout,
    PayoutStatus? PayoutRequestStatus,
    DateTime? PaidAt);

/// <summary>
/// The single source of truth for "where is this job and whose turn is it".
/// Campaign and tap assignments run through the same five steps: antagen →
/// video → granskning → views → ersättning. Both the creator screen and the
/// brand screen render this same list, so the two sides can never be told
/// different things. Nothing here is stored; it is derived from the assignment,
/// its submissions and the payout ledger every time it is read.
/// </summary>
public static class AssignmentProgress
{
    public static IReadOnlyList<ProgressStage> Stages(AssignmentFacts f)
    {
        var stages = new List<ProgressStage>(5);
        var stopped = f.Status is AssignmentStatus.Cancelled or AssignmentStatus.Disqualified;
        var paused = f.Status == AssignmentStatus.Paused;
        var hasVideo = f.PendingSubmissions + f.ApprovedSubmissions > 0;
        var approved = f.ApprovedSubmissions > 0;
        // A campaign with no view threshold pays from the first verified view.
        var viewsReached = approved && f.VerifiedViews > 0 && (f.MinViews <= 0 || f.VerifiedViews >= f.MinViews);
        var paid = f.PaidAt != null || f.PayoutRequestStatus == PayoutStatus.Completed;

        // 1 ── Antagen
        stages.Add(new("assigned", "Antagen", StageState.Done, WaitingOn.Nobody,
            f.IsTap ? "Du är med i kranen och kan börja publicera." : "Du är antagen till kampanjen."));

        if (stopped)
        {
            stages.Add(new("stopped", f.Status == AssignmentStatus.Cancelled ? "Avbrutet" : "Diskvalificerad",
                StageState.Stopped, WaitingOn.Nobody, "Uppdraget är avslutat utan utbetalning."));
            return stages;
        }

        // 2 ── Video publicerad
        stages.Add(hasVideo
            ? new("video", "Video publicerad", StageState.Done, WaitingOn.Nobody,
                f.IsTap ? "Du kan lägga till fler videor när du vill." : null)
            : new("video", "Video publicerad", paused ? StageState.Upcoming : StageState.Current,
                paused ? WaitingOn.Nobody : WaitingOn.Creator,
                paused ? "Kampanjen är pausad just nu."
                    : f.RejectedSubmissions > 0
                        ? "Förra videon nekades. Läs företagets motivering och registrera en ny."
                        : "Publicera din video på TikTok och registrera den här."));

        // 3 ── Granskning. Rejected with nothing pending means the creator is up again.
        if (f.PendingSubmissions > 0)
            stages.Add(new("review", "Godkänd av företaget", StageState.Current, WaitingOn.Brand,
                "Företaget granskar videon. Godkänns automatiskt om de inte svarar i tid.", f.NextAutoApproveAt));
        else if (approved)
            stages.Add(new("review", "Godkänd av företaget", StageState.Done, WaitingOn.Nobody,
                f.RejectedSubmissions > 0 ? "En tidigare video nekades." : null));
        else
            // Nothing awaits a decision: a rejected-only job is back on the video step above.
            stages.Add(new("review", "Godkänd av företaget", StageState.Upcoming, WaitingOn.Nobody));

        // 4 ── Views verifieras
        if (!approved)
            stages.Add(new("views", "Views verifieras", StageState.Upcoming, WaitingOn.Nobody));
        else if (viewsReached)
            stages.Add(new("views", "Views verifieras", StageState.Done, WaitingOn.Nobody,
                f.IsTap ? "Views räknas löpande varje månad." : null));
        else
            stages.Add(new("views", "Views verifieras", StageState.Current, WaitingOn.TikTok,
                f.MinViews > 0
                    ? $"{f.VerifiedViews} av {f.MinViews} views. Hämtas från TikTok en gång per dygn."
                    : "Views hämtas från TikTok en gång per dygn."));

        // 5 ── Ersättning
        stages.Add(PayoutStage(f, viewsReached, paid));

        // 6 ── Avslutat (kampanj) / löpande (kran)
        if (!f.IsTap)
            stages.Add(paid && f.Status == AssignmentStatus.Completed
                ? new("done", "Avslutat", StageState.Done, WaitingOn.Nobody, "Allt klart. Lämna gärna ett omdöme.")
                : new("done", "Avslutat", StageState.Upcoming, WaitingOn.Nobody));

        return stages;
    }

    private static ProgressStage PayoutStage(AssignmentFacts f, bool viewsReached, bool paid)
    {
        const string key = "payout", label = "Ersättning";
        if (paid)
            return new(key, label, StageState.Done, WaitingOn.Nobody, "Pengarna är utbetalda.", f.PaidAt);

        return f.PayoutRequestStatus switch
        {
            PayoutStatus.Pending or PayoutStatus.UnderReview =>
                new(key, label, StageState.Current, WaitingOn.Vyrle, "VYRLE granskar din utbetalning."),
            PayoutStatus.Approved or PayoutStatus.Processing =>
                new(key, label, StageState.Current, WaitingOn.Vyrle, "Utbetalningen är godkänd och på väg till ditt konto."),
            PayoutStatus.Rejected =>
                new(key, label, StageState.Current, WaitingOn.Creator, "Utbetalningen nekades. Se anledningen under Intäkter."),
            PayoutStatus.Failed =>
                new(key, label, StageState.Current, WaitingOn.Vyrle, "Utbetalningen misslyckades. VYRLE tittar på det."),
            _ when viewsReached && f.CurrentPayout > 0 =>
                new(key, label, StageState.Current, WaitingOn.Creator, "Din ersättning är klar att begära ut under Intäkter."),
            _ => new(key, label, StageState.Upcoming, WaitingOn.Nobody),
        };
    }

    /// <summary>The step the job is actually on: the first one not finished.</summary>
    public static ProgressStage Current(IReadOnlyList<ProgressStage> stages)
        => stages.FirstOrDefault(s => s.State is StageState.Current or StageState.Stopped)
           ?? stages[^1];

    /// <summary>One line for the creator: whose turn it is, in the creator's words.</summary>
    public static string CreatorHeadline(ProgressStage current) => current.WaitingOn switch
    {
        WaitingOn.Creator => $"Din tur: {Lower(current.Label)}",
        WaitingOn.Brand => "Väntar på företaget",
        WaitingOn.Vyrle => "Väntar på VYRLE",
        WaitingOn.TikTok => "Väntar på views från TikTok",
        _ => current.State == StageState.Stopped ? current.Label : "Inget att göra just nu",
    };

    /// <summary>The same step from the brand's side, so neither party has to guess.</summary>
    public static string BrandHeadline(ProgressStage current) => current.WaitingOn switch
    {
        WaitingOn.Brand => $"Er tur: {Lower(current.Label)}",
        WaitingOn.Creator => "Väntar på creatorn",
        WaitingOn.Vyrle => "Väntar på VYRLE",
        WaitingOn.TikTok => "Väntar på views från TikTok",
        _ => current.State == StageState.Stopped ? current.Label : "Inget att göra just nu",
    };

    private static string Lower(string label) => label.Length == 0 ? label : char.ToLowerInvariant(label[0]) + label[1..];
}
