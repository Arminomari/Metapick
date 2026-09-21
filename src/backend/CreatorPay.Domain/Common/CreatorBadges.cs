namespace CreatorPay.Domain.Common;

/// <summary>
/// The only definitions of the creator badges. Every rule reads platform data
/// (OAuth state, verified posts, the ledger) — nothing a creator can type.
/// </summary>
public static class CreatorBadges
{
    /// <summary>"Verifierad kreatör": an OAuth TikTok connection and at least one verified campaign video.</summary>
    public const int MinVerifiedPostsForVerified = 1;

    /// <summary>"Top creator": in the top 10 % by verified views among at least 10 creators with views, with a real body of work.</summary>
    public const double TopShare = 0.10;
    public const int MinPopulationForTop = 10;
    public const int MinVerifiedPostsForTop = 3;

    public static bool IsVerifiedCreator(bool tikTokVerified, int verifiedPosts)
        => tikTokVerified && verifiedPosts >= MinVerifiedPostsForVerified;

    /// <summary>
    /// Verified-view threshold for the top badge, or null when the population is
    /// too small for a percentile to mean anything.
    /// </summary>
    public static long? TopCreatorThreshold(IReadOnlyCollection<long> verifiedViewsPerCreator)
    {
        var withViews = verifiedViewsPerCreator.Where(v => v > 0).OrderBy(v => v).ToList();
        if (withViews.Count < MinPopulationForTop) return null;
        var topCount = Math.Max(1, (int)Math.Floor(withViews.Count * TopShare));
        return withViews[withViews.Count - topCount];
    }

    public static bool IsTopCreator(long verifiedViews, int verifiedPosts, long? threshold)
        => threshold.HasValue && verifiedViews >= threshold.Value && verifiedPosts >= MinVerifiedPostsForTop;

    /// <summary>TikTok video id from a share URL (…/video/7300000000000000001), or null.</summary>
    public static string? TikTokVideoId(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        var m = System.Text.RegularExpressions.Regex.Match(url, @"/video/(\d{6,})");
        return m.Success ? m.Groups[1].Value : null;
    }
}
