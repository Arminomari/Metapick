namespace CreatorPay.Application.DTOs;

// ─────────────────────────────────────────────────────────────────────────────
// Server-computed analytics. Every number here is derived on the server from
// verified TikTok posts and the payout ledger; the browser only renders.
// Each DTO carries CalculatedAt (when the server computed it) and
// MetricsUpdatedAt (the latest TikTok refresh behind the numbers).
// A null ratio means "no denominator yet", never zero.
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>Minimum sample sizes before an insight is stated. Exposed so the UI can explain the low-data state.</summary>
public record InsightThresholds(int MinVideosPerBucket, int MinBuckets, int MinCampaignsForCpm, long MinViewsPerCampaignForCpm);

/// <summary>One statement the server is willing to make. Params are the numbers; the UI owns the wording.</summary>
public record InsightDto(string Kind, string Subject, decimal Value, int SampleSize, string Unit);

public record BucketDto(string Key, string Label, int Count, long Views, long AvgViews);
public record HashtagDto(string Tag, int Count, long Views);
public record CategoryRowDto(string Category, int Campaigns, long Views, decimal Spent, decimal? Cpm, double? EngagementRate);

public record BrandCampaignRowDto(
    Guid CampaignId, string Name, string Category, string Status, bool Running,
    decimal Budget, decimal Spent, decimal Remaining, long Views, long Clicks, int Creators, int VerifiedPosts,
    decimal? Cpm, DateTime? MetricsUpdatedAt);

public record BrandCreatorRowDto(
    Guid CreatorProfileId, Guid AssignmentId, Guid CampaignId, string DisplayName, string? AvatarUrl,
    long Views, decimal Payout, decimal? CostPerThousand, bool TikTokVerified);

public record BrandVideoRowDto(
    Guid CampaignId, Guid AssignmentId, string CreatorName, string VideoUrl, long Views, long Likes, long Comments, long Shares,
    int? DurationSeconds, DateTime? PublishedAt, DateTime? MetricsUpdatedAt);

/// <summary>
/// Brand-wide summary. Scope: the brand's own campaigns (Kind = Campaign) with
/// status Active, Paused or Completed. Drafts, pending review, cancelled and
/// expired campaigns are never counted — a draft budget is not money at risk.
/// Taps are reported separately by the tap endpoints (they are monthly).
/// </summary>
public record BrandAnalyticsSummaryDto(
    DateTime CalculatedAt,
    DateTime? MetricsUpdatedAt,
    string Scope,
    int CampaignsInScope,
    int RunningCampaigns,
    // Money (SEK). RemainingBudget counts only running campaigns (Active/Paused, not past end date).
    decimal TotalBudget, decimal TotalSpent, decimal RemainingBudget,
    // Reach — TotalViews is the payout basis (verified views per assignment); engagement is over verified posts.
    long TotalViews, long Views24h, int VerifiedPosts, int TotalPosts, int Creators,
    long TotalLikes, long TotalComments, long TotalShares, long TotalClicks,
    // Derived (null when the denominator is zero)
    decimal? Cpm, long? AvgViewsPerPost, double? EngagementRate, double? ShareRate, double? ClickThroughRate,
    decimal? CostPerClick, decimal? CostPerEngagement, decimal? CostPerPost, decimal? CostPerShare, decimal? CostPerView,
    // Attention efficiency score, 0–100; null when the sample is too small to mean anything
    int? AttentionScore, string AttentionScoreFormula, int AttentionScoreMinPosts, long AttentionScoreMinViews,
    // Virality — verified posts only
    int VideosOver100K, int VideosOver500K, int VideosOver1M, double? ViralRate,
    // Breakdowns
    List<BrandCampaignRowDto> Campaigns,
    List<BrandCreatorRowDto> BestCreators,
    List<BrandVideoRowDto> TopContent,
    // Latest verified videos (by discovery time) — what Home shows as "senaste från communityn"
    List<BrandVideoRowDto> RecentContent,
    List<BucketDto> DurationBuckets,
    List<BucketDto> Dayparts,
    List<HashtagDto> TopHashtags,
    List<CategoryRowDto> ByCategory,
    // Insights: empty when the data is too thin. Thresholds explain why.
    List<InsightDto> Insights,
    InsightThresholds Thresholds,
    bool LowData,
    string Timezone);

public record CreatorCampaignRowDto(
    Guid AssignmentId, Guid CampaignId, string CampaignName, Guid BrandProfileId, string BrandName, string Status, bool IsTap,
    long Views, long Clicks, decimal Earned, DateTime AssignedAt, DateTime? MetricsUpdatedAt);

public record CreatorBrandRowDto(Guid BrandProfileId, string BrandName, decimal Earned, long Views);

public record CreatorLevelTierDto(int Index, string Name, decimal MinPaid);
public record CreatorLevelDto(int Index, string Name, decimal MinPaid, decimal TotalPaid, string? NextName, decimal? NextMinPaid, int ProgressPercent, List<CreatorLevelTierDto> Tiers);

/// <summary>
/// Creator-wide summary: verified reach, money by ledger status, tap earnings,
/// level, and the TikTok follower figure with its sync time.
/// </summary>
public record CreatorAnalyticsDto(
    DateTime CalculatedAt,
    DateTime? MetricsUpdatedAt,
    // Reach — verified views only
    long TotalVerifiedViews, long TotalClicks, double? ClickThroughRate, int VerifiedPosts,
    int ActiveAssignments, int CompletedAssignments, long? AvgViewsPerAssignment,
    // Money (SEK) — payout ledger
    decimal TotalEarned, decimal? EarningsPerThousandViews,
    decimal PaidOut, decimal Approved, decimal Pending, decimal Accrued, decimal AvailableToWithdraw,
    int PayoutCount, decimal? AvgPayout, double? PaidShare,
    decimal TapsThisMonth, decimal TapsLifetime, int TapsCount,
    // Declared by brands in accepted PR offers — not verified by VYRLE
    decimal PrValueDeclared,
    // Level from money actually paid out
    CreatorLevelDto Level,
    // TikTok
    bool TikTokVerified, string? TikTokUsername, int Followers, DateTime? FollowersSyncedAt,
    // Rows
    List<CreatorCampaignRowDto> Campaigns,
    List<CreatorBrandRowDto> TopBrands,
    // Brand decisions on submitted videos
    int ApprovedVideos = 0, int TotalVideos = 0, double? ApprovalRate = null,
    // Badges (CreatorBadges rules)
    bool VerifiedCreator = false, bool TopCreator = false);
