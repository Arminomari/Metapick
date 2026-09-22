using CreatorPay.Domain.Enums;

namespace CreatorPay.Application.DTOs;

// ──── Pagination ────
/// <summary>
/// Result type for keyset/cursor-based pagination.
/// NextCursor is null when there are no more pages.
/// </summary>
public record CursorPagedResult<T>
{
    public List<T> Data { get; init; } = [];
    public string? NextCursor { get; init; }
    public bool HasMore { get; init; }
    public int PageSize { get; init; }
}

// ──── Auth ────
public record RegisterRequest(
    string Email, string Password, string Role,
    string? FirstName, string? LastName,
    // Brand-specific
    string? CompanyName, string? OrganizationNumber, string? ContactPhone,
    // Creator-specific
    string? DisplayName, string? Country, string? Bio, string? Category,
    string? TikTokUsername, DateOnly? DateOfBirth, List<string>? ProfileTags,
    string? InstagramUsername = null,
    // Creator presence (optional). Reach numbers are never accepted from the client.
    string? AvatarUrl = null, string? Website = null,
    // Brand presence (optional)
    string? Industry = null, string? LogoUrl = null, string? Description = null,
    // Identity verification (required for creators)
    string? SelfieUrl = null);
public record LoginRequest(string Email, string Password);

// ──── Social auth ────
public record SocialLoginRequest(string Provider, string Token);
public record SocialRegisterRequest(
    string Provider, string Token, string Role,
    string? FirstName, string? LastName,
    // Brand-specific
    string? CompanyName, string? OrganizationNumber, string? ContactPhone,
    // Creator-specific
    string? DisplayName, string? Country, string? Bio, string? Category,
    string? TikTokUsername, DateOnly? DateOfBirth, List<string>? ProfileTags,
    string? InstagramUsername = null,
    string? AvatarUrl = null, string? Website = null,
    string? Industry = null, string? LogoUrl = null, string? Description = null,
    string? Email = null, string? SelfieUrl = null);
public record SocialIdentityDto(string Provider, string Email, string? FirstName, string? LastName, string? PictureUrl);
/// <summary>Status is "LoggedIn" (Auth set) or "NeedsRegistration" (Identity set, client continues to signup).</summary>
public record SocialLoginResponse(string Status, AuthResponse? Auth, SocialIdentityDto? Identity);
public record TikTokStartResponse(string Url);
public record TikTokExchangeRequest(string Code, string State);
/// <summary>TikTok signin result: "LoggedIn" (Auth set) or "NeedsRegistration" (Ticket + Identity set).</summary>
public record TikTokSigninResponse(string Status, AuthResponse? Auth, string? Ticket, SocialIdentityDto? Identity);
public record SocialProviderInfo(bool Enabled, string? ClientId);
public record SocialProvidersDto(SocialProviderInfo Google, SocialProviderInfo Apple, SocialProviderInfo Facebook);
public record RefreshTokenRequest(string RefreshToken);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
public record VerifyEmailRequest(string Token);
public record ChangeEmailRequest(string NewEmail, string CurrentPassword);
public record ResendVerificationRequest(string Email);
public record CheckEmailRequest(string Email);
public record CheckTikTokRequest(string Username);
public record BroadcastRequest(string Audience, string Subject, string Message, bool SendEmail = true);

/// <summary>Everything the platform knows about a creator account — admin eyes only.</summary>
public record AdminCreatorFullDto(
    Guid UserId, string Email, bool EmailVerified, string AccountStatus, string? AuthProvider,
    DateTime RegisteredAt, DateTime? LastLoginAt,
    Guid CreatorProfileId, string DisplayName, string? Bio, string Category, string Country, string Language,
    string? AvatarUrl, string? Website, DateOnly? DateOfBirth, List<string> ProfileTags,
    int FollowerCount, string? InstagramUsername,
    string ProfileStatus,
    string? TikTokUsername, bool TikTokConnected, bool TikTokOAuth, int TikTokFollowerCount, DateTime? TikTokLastSync,
    int ActiveAssignments, int CompletedAssignments, long TotalVerifiedViews, decimal TotalEarned, decimal TotalPaidOut,
    bool PayoutMethodConfigured, string? PayoutMethod,
    double AverageRating, int ReviewCount, int PortfolioCount,
    string? SelfieUrl = null);
public record AuthResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, Guid UserId, string Email, string Role);
public record UserProfileDto(Guid Id, string Email, string Role, string Status, string? ProfileName, string? ProfileStatus, DateTime? LastLoginAt, DateTime CreatedAt, bool EmailVerified = false);

// ──── Admin User Management ────
public record PendingUserDto(
    Guid Id, string Email, string Role, string Status, DateTime CreatedAt,
    // Brand fields
    string? CompanyName, string? OrganizationNumber, string? ContactPhone,
    // Creator fields
    string? DisplayName, string? Bio, string? Category, string? TikTokUsername,
    DateOnly? DateOfBirth,
    string? RejectionReason,
    // Vetting context for the admin review queue
    string? AuthProvider = null, string? AvatarUrl = null, int? FollowerCount = null,
    string? InstagramUsername = null, string? Website = null, string? Industry = null);

// ──── Brand ────
public record BrandProfileDto(
    Guid Id, string CompanyName, string? OrganizationNumber, string? Website,
    string Industry, string Country, string? Description, string? LogoUrl,
    string? ContactPhone, string Status, DateTime CreatedAt,
    // Organisation-number verification (SYSTEM_COMPUTED; registry or admin only)
    bool OrgVerified = false, DateTime? OrgVerifiedAt = null, string? OrgVerifiedName = null,
    string? OrgVerificationSource = null, DateTime? OrgVerificationCheckedAt = null,
    string? CoverUrl = null);

public record BrandListDto(
    Guid Id, string CompanyName, string Industry, string Country,
    string Status, DateTime CreatedAt, int CampaignCount);

public record UpdateBrandProfileRequest(
    string CompanyName, string? Website, string Industry, string? Description, string? ContactPhone,
    string? LogoUrl = null, string? OrganizationNumber = null, string? CoverUrl = null);

// ──── Creator ────
public record CreatorProfileDto(
    Guid Id, Guid UserId, string DisplayName, string? Bio, string Category, string Country,
    string Language, string? AvatarUrl,
    // Followers: TikTok API only. FollowersSyncedAt is when that number was last refreshed.
    int FollowerCount, DateTime? FollowersSyncedAt,
    string Status,
    // TikTokConnected = an account row exists; TikTokVerified = it is an OAuth connection with a token.
    bool TikTokConnected, bool TikTokVerified, string? TikTokUsername, DateTime CreatedAt,
    List<string> ProfileTags,
    string? InstagramUsername, string? Website, bool OpenToPrOffers,
    DateOnly? DateOfBirth = null, string? CoverUrl = null,
    // Whether brands can find and open this profile (CreatorVisibility), and why not
    bool VisibleToBrands = false, string? VisibilityBlocker = null,
    bool ShowInstagramBadge = false);

public record CreatorListDto(
    Guid Id, string DisplayName, string Category, string Country,
    int FollowerCount, string Status, DateTime CreatedAt);

public record UpdateCreatorProfileRequest(
    string DisplayName, string? Bio, string Category, string Country, string Language,
    string? TikTokUsername, DateOnly? DateOfBirth, List<string>? ProfileTags,
    string? AvatarUrl = null,
    string? InstagramUsername = null,
    string? Website = null, bool? OpenToPrOffers = null,
    string? CoverUrl = null, bool? ShowInstagramBadge = null);

// ──── Creator discovery (brand-facing search & public profile) ────
/// <summary>
/// Brand-facing search row. Every number is platform-verified: followers come
/// from the TikTok OAuth connection (0 and TikTokVerified=false for a typed
/// handle), views/EPM from verified campaign posts and the payout ledger.
/// </summary>
public record CreatorDiscoveryDto(
    Guid Id, Guid UserId, string DisplayName, string? Bio, string Category, string Country,
    string Language, string? AvatarUrl,
    bool TikTokConnected, bool TikTokVerified, string? TikTokUsername,
    int TikTokFollowerCount, DateTime? FollowersSyncedAt,
    string? InstagramUsername,
    List<string> ProfileTags, int PortfolioItemCount,
    double AverageRating, int ReviewCount, int CompletedCampaigns, bool OpenToPrOffers,
    long TotalVerifiedViews, decimal TotalEarned, decimal EarningsPerThousandViews,
    int ApprovedVideos, int TotalVideos, double ApprovalRate,
    DateTime? MetricsUpdatedAt, DateTime? LastActiveAt,
    // Badges from platform data only (CreatorBadges): OAuth + verified video; top decile of verified views
    bool VerifiedCreator = false, bool TopCreator = false,
    // Verified views gained in the last 7 / 30 days (daily snapshots); the creator's opt-in Instagram tag
    long Views7d = 0, long Views30d = 0, bool ShowInstagramBadge = false);

public record CreatorPublicProfileDto(
    Guid Id, Guid UserId, string DisplayName, string? Bio, string Category, string Country,
    string Language, string? AvatarUrl, string? Website,
    bool TikTokConnected, bool TikTokVerified, string? TikTokUsername,
    int TikTokFollowerCount, DateTime? FollowersSyncedAt,
    string? InstagramUsername,
    List<string> ProfileTags, bool OpenToPrOffers,
    List<PortfolioItemDto> Portfolio,
    double AverageRating, int ReviewCount, List<ReviewDto> RecentReviews,
    int CompletedCampaigns, DateTime CreatedAt,
    // "Verifierat på VYRLE": sums over every Verified campaign/tap video, all time.
    long TotalVerifiedViews = 0, long TotalLikes = 0, long TotalComments = 0,
    long TotalShares = 0, double EngagementRate = 0,
    int VerifiedPostCount = 0, DateTime? MetricsUpdatedAt = null,
    decimal TotalEarned = 0, decimal EarningsPerThousandViews = 0,
    int ApprovedVideos = 0, int TotalVideos = 0, double ApprovalRate = 0,
    string Level = "Rising",
    string? CoverUrl = null, bool VerifiedCreator = false, bool TopCreator = false,
    bool ShowInstagramBadge = false);

// ──── Portfolio ────
public record PortfolioItemDto(
    Guid Id, string Title, string? Description, string MediaType, string MediaUrl,
    string? ThumbnailUrl, string? Category, string? BrandName,
    // BrandVerified = the item is linked to a real VYRLE collaboration; otherwise the brand is the creator's own claim.
    bool BrandVerified, Guid? BrandProfileId, Guid? CampaignId, Guid? UgcCollabId,
    int SortOrder, bool IsFeatured, DateTime CreatedAt,
    // Set only when the TikTok video is one of the creator's own verified campaign videos.
    long? VerifiedViews = null, long? VerifiedLikes = null, DateTime? MetricsUpdatedAt = null);

/// <summary>A real collaboration the creator can attach a portfolio item to.</summary>
public record CreatorCollaborationDto(
    string Kind, Guid Id, Guid BrandProfileId, string BrandName, string Title, string Status, DateTime At);

public record CreatePortfolioItemRequest(
    string Title, string? Description, string MediaType, string MediaUrl,
    string? ThumbnailUrl, string? Category, string? BrandName,
    bool IsFeatured = false, Guid? CampaignId = null, Guid? UgcCollabId = null);

public record UpdatePortfolioItemRequest(
    string Title, string? Description, string MediaType, string MediaUrl,
    string? ThumbnailUrl, string? Category, string? BrandName,
    int SortOrder, bool IsFeatured, Guid? CampaignId = null, Guid? UgcCollabId = null);

// ──── PR Hub (direct brand → creator offers) ────
public record CreatePrOfferRequest(
    Guid CreatorProfileId, string Title, string Message, string OfferType, string Category,
    decimal? CompensationAmount, string? Currency, string? ProductDescription, decimal? ProductValue,
    DateTime? Deadline, Guid? CampaignId);

public record RespondPrOfferRequest(bool Accept, string? ResponseMessage);

public record PrOfferDto(
    Guid Id, Guid BrandProfileId, string BrandName, string? BrandLogoUrl,
    Guid CreatorProfileId, string CreatorName, string? CreatorAvatarUrl,
    Guid? CampaignId, string? CampaignName,
    string Title, string Message, string OfferType, string Category,
    decimal? CompensationAmount, string Currency, string? ProductDescription, decimal? ProductValue,
    DateTime? Deadline, string Status, string? ResponseMessage,
    Guid? CreatedAssignmentId, DateTime? ViewedAt, DateTime? RespondedAt, DateTime CreatedAt);

public record PrOfferStatsDto(
    int TotalSent, int Pending, int Viewed, int Accepted, int Declined,
    List<PrCategoryCountDto> ByCategory);

public record PrCategoryCountDto(string Category, int Count);

// ──── Campaign ────
public record CreateCampaignRequest(
    string Name, string Description, string? TargetAudience,
    string Country, string? Region, string Category, string RequiredHashtag,
    string? ContentInstructions, string? ForbiddenContent,
    int MinViews, int? MaxViews, string PayoutModel,
    decimal Budget, int MaxCreators, int RequiredVideoCount,
    DateTime StartDate, DateTime EndDate,
    string ReviewMode,
    List<CampaignRequirementDto> Requirements,
    List<CampaignRuleDto> Rules,
    List<PayoutRuleDto> PayoutRules,
    string? Perks,
    List<string>? ContentTags);

public record UpdateCampaignRequest(
    string? Name, string? Description, string? TargetAudience,
    string? Country, string? Region, string? Category,
    string? ContentInstructions, string? ForbiddenContent,
    int? MinViews, int? MaxViews, decimal? Budget, int? MaxCreators,
    DateTime? StartDate, DateTime? EndDate);

public record CampaignRequirementDto(string RequirementType, string Value, bool IsRequired);
public record CampaignRuleDto(string RuleType, string Description, bool IsMandatory);
public record PayoutRuleDto(
    string PayoutType,
    long MinViews,
    long? MaxViews,
    decimal Amount,
    decimal? MaxPayoutPerCreator,
    int SortOrder,
    string TriggerType = "Views",
    long MinClicks = 0,
    long? MaxClicks = null);

public record CampaignListDto(
    Guid Id, string Name, string Category, string Country, string Status,
    decimal Budget, decimal BudgetSpent, int MaxCreators, int ApprovedCreatorCount,
    DateTime StartDate, DateTime EndDate, DateTime CreatedAt);

public record AdminCampaignDto(
    Guid Id, string Name, string BrandName, string Category, string Country, string Status,
    decimal Budget, int MaxCreators, DateTime StartDate, DateTime EndDate, DateTime CreatedAt,
    string? RejectionReason);

public record CampaignDetailDto(
    Guid Id, string Name, string Description, string? TargetAudience,
    string Country, string? Region, string Category, string RequiredHashtag,
    string? ContentInstructions, string? ForbiddenContent,
    int MinViews, int? MaxViews, string PayoutModel,
    decimal Budget, decimal BudgetSpent, decimal BudgetReserved,
    int MaxCreators, int RequiredVideoCount, int ApprovedCreatorCount, long TotalViews,
    DateTime StartDate, DateTime EndDate, string Status,
    List<CampaignRequirementDto> Requirements,
    List<CampaignRuleDto> Rules,
    List<PayoutRuleDto> PayoutRules,
    DateTime CreatedAt, DateTime? PublishedAt,
    string? Perks, List<string> ContentTags);

public record CampaignBrowseDto(
    Guid Id, string Name, string BrandName, string Category, string Country,
    string Description, int MinViews, string PayoutModel, string PayoutSummary,
    int MaxCreators, int SpotsLeft, DateTime StartDate, DateTime EndDate,
    List<CampaignRequirementDto> Requirements, string? CoverImageUrl,
    string? Perks, List<string> ContentTags,
    List<PayoutRuleDto>? PayoutRules = null, Guid? BrandProfileId = null);

public record BrandPostDto(Guid Id, string Body, string? ImageUrl, DateTime CreatedAt);
public record FeedPostDto(
    Guid Id, string Body, string? ImageUrl, DateTime CreatedAt,
    Guid BrandProfileId, string BrandName, string? BrandLogoUrl);
public record CreateBrandPostRequest(string Body, string? ImageUrl);

public record BrandPublicCampaignDto(
    Guid Id, string Name, string Category, string Status, string PayoutSummary,
    DateTime StartDate, DateTime EndDate, int SpotsLeft, long TotalViews);

public record BrandPublicProfileDto(
    Guid BrandProfileId, string CompanyName, string? LogoUrl, string Industry, string Country,
    string? Description, string? Website, DateTime MemberSince,
    int FollowerCount, bool IsFollowing,
    int ActiveCampaignCount, int CompletedCampaignCount, long TotalVerifiedViews, int CreatorsWorkedWith,
    double AverageRating, int ReviewCount, List<ReviewDto> RecentReviews,
    List<BrandPublicCampaignDto> ActiveCampaigns, List<BrandPublicCampaignDto> PastCampaigns,
    List<BrandPostDto>? Posts = null,
    // The tap, as creators see it
    bool HasTap = false, decimal TapCpm = 0, string? TapName = null, string? TapBrief = null,
    string? TapHashtag = null, decimal? TapCapPerVideo = null, decimal? TapMonthlyCapPerCreator = null,
    string? MembershipStatus = null,
    // Every open tap — a brand can run several with different briefs and rates
    List<PublicTapDto>? Taps = null,
    // Registry-verified organisation number (never inferred from the number being present)
    bool OrgVerified = false,
    // Latest TikTok refresh behind TotalVerifiedViews / per-campaign views
    DateTime? MetricsUpdatedAt = null,
    string? CoverUrl = null);

public record PublicTapDto(
    Guid Id, string Name, decimal Cpm, string Brief, string RequiredHashtag,
    decimal? CapPerVideo, decimal? MonthlyCapPerCreator, string Category);

// ──── Application ────
public record ApplyToCampaignRequest(Guid CampaignId, string? Message);
public record ApplicationDto(
    Guid Id, Guid CampaignId, string CampaignName, Guid CreatorProfileId,
    string CreatorName, string? Message, string Status,
    string? ReviewNote, DateTime? ReviewedAt, DateTime CreatedAt,
    string? TikTokUsername, string? CreatorCategory, string? CreatorBio,
    string? CreatorAvatarUrl = null, long FollowerCount = 0,
    bool TikTokVerified = false, DateTime? FollowersSyncedAt = null);

// ──── Assignment ────
public record AssignmentListDto(
    Guid Id, Guid CampaignId, string CampaignName,
    string Status, long TotalVerifiedViews, long TotalTrackedClicks, decimal CurrentPayoutAmount, DateTime AssignedAt,
    bool GoalReached = false, bool IsTap = false,
    // Shared timeline (AssignmentProgress): which step the job is on and who it waits for.
    string? StageKey = null, string? StageLabel = null, string? WaitingOn = null, string? Headline = null);

/// <summary>One step of the shared creator/brand timeline.</summary>
public record ProgressStageDto(
    string Key, string Label, string State, string WaitingOn, string? Hint, DateTime? Deadline);

/// <summary>
/// The same timeline for both sides of a job. Headlines are phrased per role so
/// neither party has to guess whose turn it is.
/// </summary>
public record AssignmentProgressDto(
    List<ProgressStageDto> Stages, string CurrentKey, string CurrentLabel,
    string WaitingOn, string CreatorHeadline, string BrandHeadline);

public record AssignmentDetailDto(
    Guid Id, Guid CampaignId, string CampaignName, Guid CreatorProfileId,
    string CreatorDisplayName, string Status, long TotalVerifiedViews,
    long TotalTrackedClicks,
    decimal CurrentPayoutAmount, TrackingTagDto? TrackingTag,
    List<SubmissionDto> Submissions, List<SocialPostInfoDto> SocialPosts,
    DateTime AssignedAt, DateTime? CompletedAt,
    Guid BrandUserId, Guid CreatorUserId, bool GoalReached = false, bool IsTap = false,
    DateTime? MetricsUpdatedAt = null,
    AssignmentProgressDto? Progress = null);

public record SocialPostInfoDto(
    Guid Id, string TikTokUrl, string TikTokVideoId, long Views,
    long Likes, long Comments, long Shares, string Status, DateTime DiscoveredAt,
    DateTime? MetricsUpdatedAt = null);

public record TrackingTagDto(Guid Id, string TagCode, string RecommendedHashtag, bool IsActive);

public record CreateTrackingLinkRequest(string TargetUrl, string? Label, string? PreferredCode = null);
public record TrackingLinkDto(
    Guid Id,
    Guid AssignmentId,
    Guid CampaignId,
    Guid CreatorProfileId,
    string Code,
    string TargetUrl,
    string? Label,
    long TotalClicks,
    bool IsActive,
    DateTime CreatedAt);

// ──── Submissions ────
public record SubmitVideoRequest(string VideoUrl, string? Notes);
public record SubmissionDto(
    Guid Id, Guid AssignmentId, string TikTokVideoUrl, string? TikTokVideoId,
    string? Notes, string Status, string? RejectionReason, DateTime CreatedAt);
public record ReviewSubmissionRequest(string? Reason);

// ──── Payout ────
public record RequestPayoutRequest(Guid CalculationId);
public record PayoutRequestDto(
    Guid Id, Guid CreatorProfileId, Guid CalculationId,
    Guid AssignmentId, Guid CampaignId, string CampaignName,
    decimal Amount, string Currency, string Status, string PayoutMethod,
    string? RejectionReason, DateTime? ReviewedAt, DateTime? PaidAt, DateTime CreatedAt);
public record PayoutCalculationDto(
    Guid Id, Guid AssignmentId, long VerifiedViews, decimal CalculatedAmount,
    string Status, DateTime CalculatedAt);
public record PayoutOverrideRequest(decimal NewAmount, string Reason);

// ──── Payout method (creator's payment destination) ────
public record PayoutMethodDto(string? Method, string? MaskedDetails, string? AccountHolder, bool IsConfigured);
public record SetPayoutMethodRequest(string Method, string Details, string? AccountHolder);

// ──── Saved campaigns ────
public record SavedCampaignDto(Guid CampaignId, DateTime SavedAt, CampaignBrowseDto Campaign);

// ──── Fraud ────
public record CreateFraudFlagRequest(
    string EntityType, Guid EntityId, string FlagType,
    string Severity, string Description);
public record ResolveFraudFlagRequest(string Action, string? Note);
public record FraudFlagDto(
    Guid Id, string EntityType, Guid EntityId, string FlagType,
    string Severity, string Description, string Status,
    string? Resolution, DateTime? ResolvedAt, DateTime CreatedAt);

// ──── Common request types ────
public record RejectReasonRequest(string Reason);

// ──── Tap ("kranen") & community ────
public record UpsertTapRequest(
    string Name, decimal MonthlyBudget, decimal Cpm,
    decimal? PayoutCapPerVideo, decimal? MonthlyCapPerCreator,
    string Brief, string? ContentInstructions, string RequiredHashtag, string? Category);

public record TapDto(
    Guid Id, string Name, string Status, decimal MonthlyBudget, decimal Cpm,
    decimal? PayoutCapPerVideo, decimal? MonthlyCapPerCreator,
    string Brief, string? ContentInstructions, string RequiredHashtag, string Category,
    decimal MonthSpent, decimal MonthRemaining, long MonthViews, int ActiveCreatorsThisMonth,
    int MemberCount, DateTime? BriefUpdatedAt, DateTime CreatedAt,
    int MonthUsedPercent = 0, DateTime? CalculatedAt = null);

public record CreatorTapDto(
    Guid TapId, Guid AssignmentId, Guid BrandProfileId, string BrandName, string? BrandLogoUrl,
    string Name, string TapStatus, string MembershipStatus,
    string Brief, string? ContentInstructions, string RequiredHashtag,
    decimal Cpm, decimal? PayoutCapPerVideo, decimal? MonthlyCapPerCreator,
    decimal MyMonthEarned, long MyMonthViews, decimal MyLifetimeEarned,
    decimal TapMonthBudget, decimal TapMonthSpent, DateTime? BriefUpdatedAt,
    int TapMonthUsedPercent = 0, DateTime? CalculatedAt = null);

public record CommunityMemberDto(
    Guid CreatorProfileId, string DisplayName, string? AvatarUrl, string? TikTokUsername, int TikTokFollowers,
    string Status, string Source, DateTime JoinedAt,
    decimal LifetimeEarned, long LifetimeViews, int Collaborations,
    bool TikTokVerified = false, DateTime? FollowersSyncedAt = null);

public record MyCommunityDto(
    Guid BrandProfileId, string BrandName, string? BrandLogoUrl, string Source, DateTime JoinedAt, bool HasActiveTap,
    string Status = "Active");

public record InviteMemberRequest(Guid CreatorProfileId);

/// <summary>A video waiting for the brand's decision inside the tap.</summary>
public record TapSubmissionDto(
    Guid SubmissionId, Guid AssignmentId, string CreatorName, string? CreatorAvatarUrl,
    Guid CreatorProfileId, string VideoUrl, string? VideoId, long Views,
    DateTime SubmittedAt, int HoursUntilAutoApprove, Guid? TapId = null, string? TapName = null,
    DateTime? AutoApproveAt = null, DateTime? MetricsUpdatedAt = null);
public record InviteManyRequest(List<Guid> CreatorProfileIds);

/// <summary>Counts that deserve a red dot in the navigation — things waiting on you.</summary>
public record ActionCountsDto(int PendingApplications, int PendingVideoReviews, int AwaitingYourVideo, int PendingCommunityRequests = 0, int PendingTapReviews = 0, int UnreadSupport = 0,
    int PendingCommunityInvites = 0, int ReviewWindowHours = CreatorPay.Domain.Common.ReviewPolicy.DefaultAutoApproveHours);

// ── Admin ↔ user messages ──────────────────────────────────────────
public record SupportMessageDto(
    Guid Id, string Body, bool FromAdmin, string SenderName, bool IsRead, DateTime CreatedAt);

/// <summary>One user's thread, as the admin list sees it.</summary>
public record SupportThreadDto(
    Guid UserId, string Name, string Email, string Role, string Status,
    string LastMessage, bool LastFromAdmin, DateTime LastAt, int UnreadFromUser, int MessageCount);

public record SendSupportMessageRequest(string Body, bool SendEmail = true);

/// <summary>One cashable line per assignment, campaigns and taps alike.</summary>
/// <summary>A video straight from the creator's own TikTok account.</summary>
public record MyTikTokVideoDto(
    string VideoId, string Title, string? CoverImageUrl, string ShareUrl,
    DateTime PublishedAt, long Views, long Likes, bool AlreadyTracked, string? TrackedFor);

public record PayableDto(
    Guid AssignmentId, Guid CalculationId, string CampaignName, bool IsTap,
    decimal Earned, decimal AlreadyClaimed, decimal Available, bool HasPendingRequest,
    long VerifiedViews, DateTime CalculatedAt);
public record CreateAdminRequest(string Email, string Password, string FirstName, string LastName);
public record AdminStatsDto(
    int TotalUsers, int PendingUsers, int Creators, int Brands,
    int ActiveCampaigns, int PendingCampaigns,
    int PendingPayouts, decimal PendingPayoutAmount, decimal TotalPaidOut,
    long TotalVerifiedViews, int OpenFraudFlags);
public record TikTokCallbackRequest(string Code);

// ──── Analytics ──── (brand-wide and creator-wide summaries live in AnalyticsDtos.cs)
public record CampaignAnalyticsDto(
    Guid CampaignId, long TotalViews, long TotalClicks, int TotalCreators, decimal TotalPayoutEstimate,
    decimal BudgetSpent, decimal BudgetRemaining,
    List<CreatorPerformanceDto> CreatorPerformance,
    // Engagement aggregates over VERIFIED posts only — the same scope as TotalViews.
    // Saves are not exposed by the TikTok API yet -> always 0.
    long TotalLikes = 0, long TotalComments = 0, long TotalShares = 0, long TotalSaves = 0,
    long Views24h = 0, int TotalPosts = 0,
    int VerifiedPosts = 0, DateTime? MetricsUpdatedAt = null, DateTime? CalculatedAt = null,
    int ReviewWindowHours = 48);

public record CreatorPerformanceDto(
    Guid AssignmentId, Guid CreatorId, string DisplayName, long Views, long Clicks, decimal ClickThroughRate, decimal PayoutAmount, string Status,
    string PayoutStatus, DateTime? PaidAt,
    List<CreatorVideoDto> Videos);

public record CreatorVideoDto(
    Guid? SubmissionId, string VideoUrl, string? VideoId, long Views, long Clicks, string Status, string? RejectionReason, DateTime CreatedAt,
    long Likes = 0, long Comments = 0, long Shares = 0, int? DurationSeconds = null, DateTime? PublishedAt = null, List<string>? Hashtags = null,
    // Verified = counts toward views/payout. MetricsUpdatedAt = last TikTok refresh (null = never synced).
    bool Verified = false, DateTime? MetricsUpdatedAt = null,
    // Set while a brand decision is pending: when the video is approved automatically.
    DateTime? AutoApproveAt = null);

// Platform-wide CPM benchmark so brands can see how their campaigns compare to the market.
public record MarketBenchmarkDto(decimal MarketCpm, long TotalViews, decimal TotalSpend, List<NicheBenchmarkDto> ByCategory);
public record NicheBenchmarkDto(string Category, decimal Cpm, long Views, long AvgViewsPerCampaign, int Campaigns);

// ──── Notification ────
public record NotificationDto(
    Guid Id, string Type, string Title, string Message,
    bool IsRead, Guid? ReferenceId, DateTime CreatedAt, string? ReferenceType = null);

// ──── Dispute ────
public record DisputeDto(
    Guid Id, Guid CampaignId, string CampaignName, string Type,
    string Title, string Description, string Status, DateTime CreatedAt);
public record CreateDisputeRequest(Guid CampaignId, Guid? AssignmentId, string Type, string Title, string Description);
public record ResolveDisputeRequest(string Resolution, string Status);

// ──── Audit ────
public record AuditLogDto(
    Guid Id, Guid? UserId, string Action, string? EntityType,
    Guid? EntityId, string? IpAddress, DateTime CreatedAt,
    string? UserEmail = null, string? UserRole = null);

// ──── Reviews ────
public record SubmitReviewRequest(int Stars, string? Comment);
public record ReviewDto(
    Guid Id, Guid AssignmentId, Guid ReviewerId, string ReviewerRole,
    string ReviewerName, int Stars, string? Comment, DateTime CreatedAt);
public record UserReviewSummaryDto(
    double AverageStars, int TotalReviews, List<ReviewDto> Reviews);

// ──── Chat ────
public record SendMessageRequest(string Body);
public record ChatMessageDto(
    Guid Id, Guid? AssignmentId, Guid SenderId, string SenderRole,
    string SenderName, string Body, bool IsRead, DateTime CreatedAt);
public record ChatConversationDto(
    Guid AssignmentId, string CounterpartName, string? CounterpartImageUrl,
    string CampaignName, string? LastMessage, DateTime? LastMessageAt, int UnreadCount,
    Guid? CounterpartProfileId = null, string? CounterpartRole = null,
    string ThreadId = "", bool IsDirect = false);
