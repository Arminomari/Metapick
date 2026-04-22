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
    string? TikTokUsername, DateOnly? DateOfBirth);
public record LoginRequest(string Email, string Password);
public record RefreshTokenRequest(string RefreshToken);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record AuthResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt, Guid UserId, string Email, string Role);
public record UserProfileDto(Guid Id, string Email, string Role, string Status, string? ProfileName, string? ProfileStatus, DateTime? LastLoginAt, DateTime CreatedAt);

// ──── Admin User Management ────
public record PendingUserDto(
    Guid Id, string Email, string Role, string Status, DateTime CreatedAt,
    // Brand fields
    string? CompanyName, string? OrganizationNumber, string? ContactPhone,
    // Creator fields
    string? DisplayName, string? Bio, string? Category, string? TikTokUsername,
    DateOnly? DateOfBirth,
    string? RejectionReason);

// ──── Brand ────
public record BrandProfileDto(
    Guid Id, string CompanyName, string? OrganizationNumber, string? Website,
    string Industry, string Country, string? Description, string? LogoUrl,
    string? ContactPhone, string Status, DateTime CreatedAt);

public record BrandListDto(
    Guid Id, string CompanyName, string Industry, string Country,
    string Status, DateTime CreatedAt, int CampaignCount);

public record UpdateBrandProfileRequest(
    string CompanyName, string? Website, string Industry, string? Description, string? ContactPhone);

// ──── Creator ────
public record CreatorProfileDto(
    Guid Id, string DisplayName, string? Bio, string Category, string Country,
    string Language, string? AvatarUrl, int FollowerCount, int? AverageViews,
    string Status, bool TikTokConnected, string? TikTokUsername, DateTime CreatedAt,
    List<string> ProfileTags);

public record CreatorListDto(
    Guid Id, string DisplayName, string Category, string Country,
    int FollowerCount, int? AverageViews, string Status, DateTime CreatedAt);

public record UpdateCreatorProfileRequest(
    string DisplayName, string? Bio, string Category, string Country, string Language,
    string? TikTokUsername, DateOnly? DateOfBirth, List<string>? ProfileTags);

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
public record PayoutRuleDto(string PayoutType, long MinViews, long? MaxViews, decimal Amount, decimal? MaxPayoutPerCreator, int SortOrder);

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
    string? Perks, List<string> ContentTags);

// ──── Application ────
public record ApplyToCampaignRequest(Guid CampaignId, string? Message);
public record ApplicationDto(
    Guid Id, Guid CampaignId, string CampaignName, Guid CreatorProfileId,
    string CreatorName, string? Message, string Status,
    string? ReviewNote, DateTime? ReviewedAt, DateTime CreatedAt,
    string? TikTokUsername, string? CreatorCategory, string? CreatorBio);

// ──── Assignment ────
public record AssignmentListDto(
    Guid Id, Guid CampaignId, string CampaignName,
    string Status, long TotalVerifiedViews, decimal CurrentPayoutAmount, DateTime AssignedAt);

public record AssignmentDetailDto(
    Guid Id, Guid CampaignId, string CampaignName, Guid CreatorProfileId,
    string CreatorDisplayName, string Status, long TotalVerifiedViews,
    decimal CurrentPayoutAmount, TrackingTagDto? TrackingTag,
    List<SubmissionDto> Submissions, List<SocialPostInfoDto> SocialPosts,
    DateTime AssignedAt, DateTime? CompletedAt);

public record SocialPostInfoDto(
    Guid Id, string TikTokUrl, string TikTokVideoId, long Views,
    long Likes, long Comments, long Shares, string Status, DateTime DiscoveredAt);

public record TrackingTagDto(Guid Id, string TagCode, string RecommendedHashtag, bool IsActive);

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
public record TikTokCallbackRequest(string Code);

// ──── Analytics ────
public record CreatorAnalyticsDto(
    decimal TotalEarnings, decimal PendingPayouts, decimal PaidOut,
    int ActiveCampaigns, int CompletedCampaigns, long TotalVerifiedViews,
    List<CampaignEarningDto> Campaigns);

public record CampaignEarningDto(
    Guid CampaignId, string CampaignName, long Views, decimal Earned, string Status);

public record CampaignAnalyticsDto(
    Guid CampaignId, long TotalViews, int TotalCreators, decimal TotalPayoutEstimate,
    decimal BudgetSpent, decimal BudgetRemaining,
    List<CreatorPerformanceDto> CreatorPerformance);

public record CreatorPerformanceDto(
    Guid AssignmentId, Guid CreatorId, string DisplayName, long Views, decimal PayoutAmount, string Status,
    string PayoutStatus, DateTime? PaidAt,
    List<CreatorVideoDto> Videos);

public record CreatorVideoDto(Guid? SubmissionId, string VideoUrl, string? VideoId, long Views, string Status, string? RejectionReason, DateTime CreatedAt);

// ──── Notification ────
public record NotificationDto(
    Guid Id, string Type, string Title, string Message,
    bool IsRead, Guid? ReferenceId, DateTime CreatedAt);

// ──── Dispute ────
public record DisputeDto(
    Guid Id, Guid CampaignId, string CampaignName, string Type,
    string Title, string Description, string Status, DateTime CreatedAt);
public record CreateDisputeRequest(Guid CampaignId, Guid? AssignmentId, string Type, string Title, string Description);
public record ResolveDisputeRequest(string Resolution, string Status);

// ──── Audit ────
public record AuditLogDto(
    Guid Id, Guid? UserId, string Action, string? EntityType,
    Guid? EntityId, string? IpAddress, DateTime CreatedAt);
