namespace CreatorPay.Application.Services;

/// <summary>
/// Verified performance of one creator as discovery ranks it: views, money and
/// review decisions from campaign/tap assignments that actually ran. Nothing here
/// is typed by the creator.
/// </summary>
public sealed record CreatorPerformance(
    long VerifiedViews, decimal Earned, int Completed, int Approved, int Decided, int VerifiedPosts,
    DateTime? MetricsUpdatedAt, DateTime? LastActive,
    // Verified views gained in the last 7 / 30 days (from daily metric snapshots)
    long Views7d = 0, long Views30d = 0)
{
    public long RecentViews(int windowDays) => windowDays >= 30 ? Views30d : Views7d;
    public static readonly CreatorPerformance Empty = new(0, 0, 0, 0, 0, 0, null, null);
    public decimal Epm => VerifiedViews > 0 ? Math.Round(Earned / VerifiedViews * 1000m, 2) : 0m;
    public double ApprovalRate => Decided > 0 ? Math.Round(Approved * 100.0 / Decided, 1) : 0;
    /// <summary>At least one verified video or verified view: the creator has a track record on VYRLE.</summary>
    public bool HasResults => VerifiedPosts > 0 || VerifiedViews > 0;
}

/// <summary>
/// Ranking and filters for "Hitta creators". The primary signal is always verified
/// performance; followers are a tie-breaker or an explicit secondary sort, never the default.
/// </summary>
public static class CreatorRanking
{
    public const string DefaultSort = "views";
    /// <summary>"Presterat nyligen": the bar a creator must clear to be listed in Hitta by default.</summary>
    public const long Recent7dViews = 10_000;
    public const long Recent30dViews = 100_000;
    public static bool PerformedRecently(CreatorPerformance p) => p.Views7d >= Recent7dViews || p.Views30d >= Recent30dViews;
    public static int NormalizeWindow(int? days) => days >= 30 ? 30 : 7;

    /// <summary>
    /// Views gained inside a window, from cumulative daily snapshots: latest count minus the
    /// last snapshot on or before the cutoff. A post published inside the window counts from
    /// zero. An older post with no snapshot before the cutoff counts from its earliest snapshot
    /// inside the window (conservative); with no snapshots at all it counts nothing.
    /// </summary>
    public static long WindowViews(long latestViews, DateTime publishedAt, DateOnly cutoff, IReadOnlyList<(DateOnly Date, long Views)> snapshots)
    {
        (DateOnly Date, long Views)? before = null, firstAfter = null;
        foreach (var s in snapshots)
        {
            if (s.Date <= cutoff) { if (before == null || s.Date > before.Value.Date) before = s; }
            else if (firstAfter == null || s.Date < firstAfter.Value.Date) firstAfter = s;
        }
        long baseline;
        if (before != null) baseline = before.Value.Views;
        else if (DateOnly.FromDateTime(publishedAt) > cutoff) baseline = 0;
        else if (firstAfter != null) baseline = firstAfter.Value.Views;
        else return 0;
        return Math.Max(0, latestViews - baseline);
    }
    public static readonly string[] Sorts = ["views", "epm", "approval", "active", "rating", "followers", "recent"];

    public static IEnumerable<T> Order<T>(
        IEnumerable<T> items, string? sort,
        Func<T, CreatorPerformance> perf, Func<T, int> verifiedFollowers, Func<T, double> rating, Func<T, DateTime> createdAt,
        int windowDays = 7)
        => (sort?.ToLowerInvariant()) switch
        {
            "followers" => items.OrderByDescending(verifiedFollowers).ThenByDescending(x => perf(x).VerifiedViews),
            "rating"    => items.OrderByDescending(rating).ThenByDescending(x => perf(x).VerifiedViews),
            "recent"    => items.OrderByDescending(createdAt),
            "epm"       => items.OrderByDescending(x => perf(x).Epm).ThenByDescending(x => perf(x).VerifiedViews),
            "approval"  => items.OrderByDescending(x => perf(x).ApprovalRate).ThenByDescending(x => perf(x).Decided),
            "active"    => items.OrderByDescending(x => perf(x).LastActive ?? DateTime.MinValue),
            // Relevans: what the creator did in the chosen window first, then the whole track record, then verified followers.
            _           => items.OrderByDescending(x => perf(x).RecentViews(windowDays)).ThenByDescending(x => perf(x).VerifiedViews).ThenByDescending(verifiedFollowers),
        };

    /// <summary>Filters that only ever look at verified numbers. A creator with no decisions never passes an approval-rate floor.</summary>
    public static bool Passes(CreatorPerformance p, long? minVerifiedViews, double? minApprovalRate, bool onlyWithResults, bool recentOnly = false)
    {
        if (recentOnly && !PerformedRecently(p)) return false;
        if (onlyWithResults && !p.HasResults) return false;
        if (minVerifiedViews is > 0 && p.VerifiedViews < minVerifiedViews) return false;
        if (minApprovalRate is > 0 && (p.Decided == 0 || p.ApprovalRate < minApprovalRate)) return false;
        return true;
    }
}
