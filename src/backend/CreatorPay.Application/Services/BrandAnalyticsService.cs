using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Common;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

/// <summary>
/// Pure aggregation over a brand's campaigns. No database, no clock of its
/// own — the caller passes "now" and the timezone — so every rule here is
/// unit-testable. This is the only place brand-wide numbers are computed.
/// </summary>
public static class BrandAnalyticsCalculator
{
    public static readonly InsightThresholds Thresholds = new(
        MinVideosPerBucket: 5, MinBuckets: 2, MinCampaignsForCpm: 2, MinViewsPerCampaignForCpm: 1000);

    public const int AttentionMinPosts = 3;
    public const long AttentionMinViews = 1000;
    public const string AttentionFormula =
        "100 × (0,45 × min(1, ER / 12,5 %) + 0,25 × min(1, delningsgrad / 2,5 %) + 0,30 × min(1, CTR / 5 %))";

    private static readonly (string Key, string Label, int Min, int? Max)[] DurationBuckets =
    [
        ("0-15", "0–15 s", 0, 15), ("15-30", "15–30 s", 15, 30), ("30-45", "30–45 s", 30, 45),
        ("45-60", "45–60 s", 45, 60), ("60+", "60+ s", 60, null),
    ];

    private static readonly (string Key, string Label, int From, int To)[] Dayparts =
    [
        ("morning", "Morgon 06–11", 6, 11), ("day", "Dag 12–17", 12, 17),
        ("evening", "Kväll 18–23", 18, 23), ("night", "Natt 00–05", 0, 5),
    ];

    public static bool InScope(Campaign c) =>
        c.Kind == CampaignKind.Campaign && !c.IsDeleted &&
        c.Status is CampaignStatus.Active or CampaignStatus.Paused or CampaignStatus.Completed;

    public static bool IsRunning(Campaign c, DateTime today) =>
        c.Status is CampaignStatus.Active or CampaignStatus.Paused && c.EndDate.Date >= today;

    public static IEnumerable<CreatorCampaignAssignment> Counted(Campaign c) =>
        c.Assignments.Where(a => a.Status is AssignmentStatus.Active or AssignmentStatus.Completed);

    public static IEnumerable<SocialPost> VerifiedPosts(CreatorCampaignAssignment a) =>
        a.SocialPosts.Where(sp => sp.IsActive && sp.VerificationStatus == VerificationStatus.Verified);

    /// <summary>Money actually earned by creators so far — the same figure the campaign list shows.</summary>
    public static decimal LiveSpent(Campaign c) => Counted(c).Sum(a => a.CurrentPayoutAmount);

    public static BrandAnalyticsSummaryDto Compute(IReadOnlyList<Campaign> all, DateTime nowUtc, TimeZoneInfo tz)
    {
        var today = nowUtc.Date;
        var campaigns = all.Where(InScope).ToList();

        var rows = campaigns.Select(c =>
        {
            var counted = Counted(c).ToList();
            var spent = counted.Sum(a => a.CurrentPayoutAmount);
            var views = counted.Sum(a => a.TotalVerifiedViews);
            var running = IsRunning(c, today);
            var posts = counted.SelectMany(VerifiedPosts).ToList();
            return new BrandCampaignRowDto(
                c.Id, c.Name, c.Category,
                running ? c.Status.ToString() : "Completed",
                running,
                c.Budget, spent, running ? Math.Max(0, c.Budget - spent) : 0m,
                views, counted.Sum(a => a.TrackingLinks.Where(l => l.IsActive).Sum(l => l.TotalClicks)),
                counted.Count, posts.Count,
                views > 0 ? Math.Round(spent / views * 1000m, 2) : null,
                posts.Max(p => p.MetricsUpdatedAt));
        }).ToList();

        var countedAssignments = campaigns.SelectMany(Counted).ToList();
        var vposts = campaigns
            .SelectMany(c => Counted(c).SelectMany(a => VerifiedPosts(a).Select(sp => (Campaign: c, Assignment: a, Post: sp))))
            .ToList();
        var allActivePosts = countedAssignments.SelectMany(a => a.SocialPosts.Where(sp => sp.IsActive)).ToList();

        var totalBudget = rows.Sum(r => r.Budget);
        var totalSpent = rows.Sum(r => r.Spent);
        var remaining = rows.Sum(r => r.Remaining);
        var totalViews = rows.Sum(r => r.Views);
        var totalClicks = rows.Sum(r => r.Clicks);
        var creators = countedAssignments.Select(a => a.CreatorProfileId).Distinct().Count();

        var vViews = vposts.Sum(x => x.Post.LatestViewCount);
        var likes = vposts.Sum(x => x.Post.LatestLikeCount);
        var comments = vposts.Sum(x => x.Post.LatestCommentCount);
        var shares = vposts.Sum(x => x.Post.LatestShareCount);
        var engagement = likes + comments + shares;
        var verifiedPosts = vposts.Count;

        var views24h = vposts.Sum(x =>
        {
            var snaps = x.Post.MetricSnapshots.OrderByDescending(m => m.SnapshotDate).Take(2).ToList();
            return snaps.Count >= 2 ? Math.Max(0, snaps[0].ViewCount - snaps[1].ViewCount) : 0;
        });

        decimal? cpm = totalViews > 0 ? Math.Round(totalSpent / totalViews * 1000m, 2) : null;
        long? avgPerPost = verifiedPosts > 0 ? vViews / verifiedPosts : null;
        double? er = vViews > 0 ? Math.Round(engagement * 100.0 / vViews, 2) : null;
        double? shr = vViews > 0 ? Math.Round(shares * 100.0 / vViews, 2) : null;
        double? ctr = totalViews > 0 ? Math.Round(totalClicks * 100.0 / totalViews, 2) : null;

        int? attention = null;
        if (verifiedPosts >= AttentionMinPosts && vViews >= AttentionMinViews && er.HasValue && shr.HasValue)
        {
            var e = Math.Min(1.0, er.Value / 12.5);
            var s = Math.Min(1.0, shr.Value / 2.5);
            var c = Math.Min(1.0, (ctr ?? 0) / 5.0);
            attention = (int)Math.Round(100 * (0.45 * e + 0.25 * s + 0.30 * c));
        }

        var over100k = vposts.Count(x => x.Post.LatestViewCount >= 100_000);
        var over500k = vposts.Count(x => x.Post.LatestViewCount >= 500_000);
        var over1m = vposts.Count(x => x.Post.LatestViewCount >= 1_000_000);

        var bestCreators = countedAssignments
            .GroupBy(a => a.CreatorProfileId)
            .Select(g =>
            {
                var first = g.OrderByDescending(a => a.TotalVerifiedViews).First();
                var views = g.Sum(a => a.TotalVerifiedViews);
                var payout = g.Sum(a => a.CurrentPayoutAmount);
                return new BrandCreatorRowDto(
                    g.Key, first.Id, first.CampaignId,
                    first.CreatorProfile?.DisplayName ?? "Creator", first.CreatorProfile?.AvatarUrl,
                    views, payout, views > 0 ? Math.Round(payout / views * 1000m, 2) : null,
                    first.CreatorProfile?.TikTokAccount.IsVerified() ?? false);
            })
            .Where(r => r.Views > 0)
            .OrderByDescending(r => r.Views)
            .Take(6)
            .ToList();

        BrandVideoRowDto Row((Campaign Campaign, CreatorCampaignAssignment Assignment, SocialPost Post) x) => new(
            x.Campaign.Id, x.Assignment.Id, x.Assignment.CreatorProfile?.DisplayName ?? "Creator",
            x.Post.TikTokUrl, x.Post.LatestViewCount, x.Post.LatestLikeCount, x.Post.LatestCommentCount, x.Post.LatestShareCount,
            x.Post.Duration, x.Post.PublishedAt, x.Post.MetricsUpdatedAt);
        var topContent = vposts.OrderByDescending(x => x.Post.LatestViewCount).Take(6).Select(Row).ToList();
        var recentContent = vposts.OrderByDescending(x => x.Post.DiscoveredAt).Take(3).Select(Row).ToList();

        // Duration: only posts whose length TikTok reported.
        var withDuration = vposts.Where(x => x.Post.Duration.HasValue).ToList();
        var durationBuckets = DurationBuckets.Select(b =>
        {
            var inBucket = withDuration.Where(x => x.Post.Duration!.Value >= b.Min && (b.Max == null || x.Post.Duration.Value < b.Max)).ToList();
            var v = inBucket.Sum(x => x.Post.LatestViewCount);
            return new BucketDto(b.Key, b.Label, inBucket.Count, v, inBucket.Count > 0 ? v / inBucket.Count : 0);
        }).ToList();

        // Daypart: only synced posts (PublishedAt then comes from TikTok, not from the submission time),
        // converted to the brand's timezone — never the viewer's browser.
        var synced = vposts.Where(x => x.Post.MetricsUpdatedAt.HasValue).ToList();
        var dayparts = Dayparts.Select(d =>
        {
            var inBucket = synced.Where(x =>
            {
                var hour = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(x.Post.PublishedAt, DateTimeKind.Utc), tz).Hour;
                return hour >= d.From && hour <= d.To;
            }).ToList();
            var v = inBucket.Sum(x => x.Post.LatestViewCount);
            return new BucketDto(d.Key, d.Label, inBucket.Count, v, inBucket.Count > 0 ? v / inBucket.Count : 0);
        }).ToList();

        // Hashtags: only from captions TikTok returned (synced posts), never from a creator's notes.
        var hashtags = synced
            .SelectMany(x => ExtractHashtags(x.Post.Caption).Select(tag => (tag, x.Post.LatestViewCount)))
            .GroupBy(t => t.tag)
            .Select(g => new HashtagDto(g.Key, g.Count(), g.Sum(t => t.LatestViewCount)))
            .OrderByDescending(h => h.Views)
            .Take(8)
            .ToList();

        var byCategory = campaigns
            .GroupBy(c => c.Category)
            .Select(g =>
            {
                var ids = g.Select(c => c.Id).ToHashSet();
                var views = rows.Where(r => ids.Contains(r.CampaignId)).Sum(r => r.Views);
                var spent = rows.Where(r => ids.Contains(r.CampaignId)).Sum(r => r.Spent);
                var catPosts = vposts.Where(x => ids.Contains(x.Campaign.Id)).ToList();
                var catViews = catPosts.Sum(x => x.Post.LatestViewCount);
                var catEng = catPosts.Sum(x => x.Post.LatestLikeCount + x.Post.LatestCommentCount + x.Post.LatestShareCount);
                return new CategoryRowDto(g.Key, g.Count(), views, spent,
                    views > 0 ? Math.Round(spent / views * 1000m, 2) : null,
                    catViews > 0 ? Math.Round(catEng * 100.0 / catViews, 2) : null);
            })
            .OrderByDescending(r => r.Views)
            .Take(6)
            .ToList();

        var insights = BuildInsights(rows, durationBuckets, dayparts);

        return new BrandAnalyticsSummaryDto(
            nowUtc,
            allActivePosts.Max(p => p.MetricsUpdatedAt),
            "Aktiva, pausade och avslutade kampanjer. Utkast räknas inte.",
            campaigns.Count,
            rows.Count(r => r.Running),
            totalBudget, totalSpent, remaining,
            totalViews, views24h, verifiedPosts, allActivePosts.Count, creators,
            likes, comments, shares, totalClicks,
            cpm, avgPerPost, er, shr, ctr,
            totalClicks > 0 ? Math.Round(totalSpent / totalClicks, 2) : null,
            engagement > 0 ? Math.Round(totalSpent / engagement, 2) : null,
            verifiedPosts > 0 ? Math.Round(totalSpent / verifiedPosts, 2) : null,
            shares > 0 ? Math.Round(totalSpent / shares, 2) : null,
            totalViews > 0 ? Math.Round(totalSpent / totalViews, 3) : null,
            attention, AttentionFormula, AttentionMinPosts, AttentionMinViews,
            over100k, over500k, over1m,
            verifiedPosts > 0 ? Math.Round(over100k * 100.0 / verifiedPosts, 1) : null,
            rows.OrderByDescending(r => r.Views).ToList(),
            bestCreators, topContent, recentContent, durationBuckets, dayparts, hashtags, byCategory,
            insights, Thresholds, insights.Count == 0, tz.Id);
    }

    /// <summary>An insight is only stated when the sample behind it is large enough to be a pattern, not an anecdote.</summary>
    public static List<InsightDto> BuildInsights(List<BrandCampaignRowDto> rows, List<BucketDto> durationBuckets, List<BucketDto> dayparts)
    {
        var insights = new List<InsightDto>();
        var t = Thresholds;

        var cpmCandidates = rows.Where(r => r.Views >= t.MinViewsPerCampaignForCpm && r.Spent > 0 && r.Cpm.HasValue).ToList();
        if (cpmCandidates.Count >= t.MinCampaignsForCpm)
        {
            var best = cpmCandidates.OrderBy(r => r.Cpm).First();
            insights.Add(new InsightDto("LowestCpmCampaign", best.Name, best.Cpm!.Value, cpmCandidates.Count, "SEK"));
        }

        var dur = durationBuckets.Where(b => b.Count >= t.MinVideosPerBucket).ToList();
        if (dur.Count >= t.MinBuckets)
        {
            var best = dur.OrderByDescending(b => b.AvgViews).First();
            insights.Add(new InsightDto("BestDuration", best.Label, best.AvgViews, best.Count, "views"));
        }

        var dp = dayparts.Where(b => b.Count >= t.MinVideosPerBucket).ToList();
        if (dp.Count >= t.MinBuckets)
        {
            var best = dp.OrderByDescending(b => b.AvgViews).First();
            insights.Add(new InsightDto("BestDaypart", best.Label, best.AvgViews, best.Count, "views"));
        }

        return insights;
    }

    public static List<string> ExtractHashtags(string? caption)
    {
        if (string.IsNullOrWhiteSpace(caption)) return [];
        return System.Text.RegularExpressions.Regex.Matches(caption, "#([\\p{L}\\p{N}_]+)")
            .Select(m => m.Groups[1].Value.ToLowerInvariant())
            .Distinct()
            .Take(10)
            .ToList();
    }

    public static TimeZoneInfo StockholmOrUtc()
    {
        foreach (var id in new[] { "Europe/Stockholm", "W. Europe Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }
}

public class BrandAnalyticsService : IBrandAnalyticsService
{
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<Campaign> _campaigns;

    public BrandAnalyticsService(IRepository<BrandProfile> brands, IRepository<Campaign> campaigns)
    {
        _brands = brands;
        _campaigns = campaigns;
    }

    public async Task<Result<BrandAnalyticsSummaryDto>> GetSummaryAsync(Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var campaigns = await _campaigns.Query()
            .Include(c => c.Assignments).ThenInclude(a => a.CreatorProfile).ThenInclude(p => p.TikTokAccount)
            .Include(c => c.Assignments).ThenInclude(a => a.SocialPosts).ThenInclude(sp => sp.MetricSnapshots)
            .Include(c => c.Assignments).ThenInclude(a => a.TrackingLinks)
            .Where(c => c.BrandProfileId == brand.Id && !c.IsDeleted && c.Kind == CampaignKind.Campaign
                && (c.Status == CampaignStatus.Active || c.Status == CampaignStatus.Paused || c.Status == CampaignStatus.Completed))
            .ToListAsync(ct);

        return BrandAnalyticsCalculator.Compute(campaigns, DateTime.UtcNow, BrandAnalyticsCalculator.StockholmOrUtc());
    }
}
