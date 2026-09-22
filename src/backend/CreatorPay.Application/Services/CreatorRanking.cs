namespace CreatorPay.Application.Services;

/// <summary>
/// Verified performance of one creator as discovery ranks it: views, money and
/// review decisions from campaign/tap assignments that actually ran. Nothing here
/// is typed by the creator.
/// </summary>
public sealed record CreatorPerformance(
    long VerifiedViews, decimal Earned, int Completed, int Approved, int Decided, int VerifiedPosts,
    DateTime? MetricsUpdatedAt, DateTime? LastActive)
{
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
    public static readonly string[] Sorts = ["views", "epm", "approval", "active", "rating", "followers", "recent"];

    public static IEnumerable<T> Order<T>(
        IEnumerable<T> items, string? sort,
        Func<T, CreatorPerformance> perf, Func<T, int> verifiedFollowers, Func<T, double> rating, Func<T, DateTime> createdAt)
        => (sort?.ToLowerInvariant()) switch
        {
            "followers" => items.OrderByDescending(verifiedFollowers).ThenByDescending(x => perf(x).VerifiedViews),
            "rating"    => items.OrderByDescending(rating).ThenByDescending(x => perf(x).VerifiedViews),
            "recent"    => items.OrderByDescending(createdAt),
            "epm"       => items.OrderByDescending(x => perf(x).Epm).ThenByDescending(x => perf(x).VerifiedViews),
            "approval"  => items.OrderByDescending(x => perf(x).ApprovalRate).ThenByDescending(x => perf(x).Decided),
            "active"    => items.OrderByDescending(x => perf(x).LastActive ?? DateTime.MinValue),
            _           => items.OrderByDescending(x => perf(x).VerifiedViews).ThenByDescending(verifiedFollowers),
        };

    /// <summary>Filters that only ever look at verified numbers. A creator with no decisions never passes an approval-rate floor.</summary>
    public static bool Passes(CreatorPerformance p, long? minVerifiedViews, double? minApprovalRate, bool onlyWithResults)
    {
        if (onlyWithResults && !p.HasResults) return false;
        if (minVerifiedViews is > 0 && p.VerifiedViews < minVerifiedViews) return false;
        if (minApprovalRate is > 0 && (p.Decided == 0 || p.ApprovalRate < minApprovalRate)) return false;
        return true;
    }
}
