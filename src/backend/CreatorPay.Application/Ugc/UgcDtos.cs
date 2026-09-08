namespace CreatorPay.Application.Ugc;

// ═══════════════════════════════════════════════════════════════════
// Wire shapes for the marketplace. Money is öre (long) everywhere;
// enums travel as their names.
// ═══════════════════════════════════════════════════════════════════

// ── Creator ────────────────────────────────────────────────────────
public record UgcCreatorProfileDto(
    Guid CreatorProfileId, string DisplayName, string? AvatarUrl,
    string Status, string? StatusNote, int Strikes,
    string[] Categories, string? City, string? Region, string[] Languages, string? SampleVideoUrl,
    int FollowerSnapshot, decimal LikeFollowerRatio, DateTime? SocialSnapshotAt,
    int DeliveredCount, int OnTimeCount, int LateCount, decimal AverageRating, int RatingCount,
    bool HasStripeAccount, bool PayoutOnboardingComplete, bool HasFTax, bool VatRegistered, string? VatNumber,
    bool AllowPortfolioUse,
    bool CanTakePaid, bool CanTakeProduct, string? Blocker);

public record UpsertUgcCreatorProfileRequest(
    string[]? Categories, string? City, string? Region, string[]? Languages, string? SampleVideoUrl,
    bool? HasFTax, bool? VatRegistered, string? VatNumber, bool? AllowPortfolioUse);

public record UgcPayoutOnboardingDto(string? Url, bool Complete, string? AccountId, bool Configured, string? Message);

// ── Campaign ───────────────────────────────────────────────────────
public record UgcBriefDto(
    string Goal, string Format, int LengthSeconds, int VideoCount, string[] Hooks,
    string CallToAction, string[] ReferenceUrls, string[] Dos, string[] Donts, string? ExtraNotes);

public record UgcCampaignDto(
    Guid Id, Guid BrandProfileId, string BrandName, string? BrandLogoUrl,
    string Title, UgcBriefDto Brief, bool BriefGeneratedByAi,
    string? Region, string[] Categories, int? MinFollowers, int? MaxFollowers,
    string Compensation, long BudgetMinOre, long BudgetMaxOre, string? ProductDescription, long? ProductValueOre,
    string RightsPackage, int DeadlineDays, int Slots,
    int HiredCount, int ApplicationCount, int PendingApplicationCount,
    string Status, DateTime? PublishedAt, DateTime? ClosedAt, DateTime CreatedAt,
    string? MyApplicationStatus = null, Guid? MyApplicationId = null, long? MyBidOre = null, Guid? MyCollabId = null);

public record UpsertUgcCampaignRequest(
    string Title, UgcBriefDto Brief,
    string? Region, string[]? Categories, int? MinFollowers, int? MaxFollowers,
    string Compensation, long BudgetMinOre, long BudgetMaxOre, string? ProductDescription, long? ProductValueOre,
    string RightsPackage, int DeadlineDays, int Slots, bool BriefGeneratedByAi = false);

public record GenerateUgcBriefRequest(string? Goal, string? ProductOrService, string? Audience, string? Tone, string? Extra);

// ── Application (bid) ──────────────────────────────────────────────
public record UgcApplicationDto(
    Guid Id, Guid CampaignId, string CampaignTitle,
    Guid CreatorProfileId, string CreatorName, string? CreatorAvatarUrl, string? CreatorCategory,
    string? City, string? Region, int Followers, decimal LikeFollowerRatio,
    int DeliveredCount, int OnTimeCount, decimal AverageRating, int RatingCount, string CreatorStatus,
    long BidOre, string Pitch, string Status, DateTime CreatedAt, DateTime? DecidedAt, string? DecisionNote, Guid? CollabId);

public record ApplyToUgcCampaignRequest(long BidOre, string Pitch);
public record DecideUgcApplicationRequest(string? Note);

// ── Collab ─────────────────────────────────────────────────────────
public record UgcDeliverableDto(
    Guid Id, int Version, string FileUrl, string ContentType, long FileSizeBytes, int? DurationSeconds,
    string? CreatorComment, string? BrandFeedback, DateTime? FeedbackAt, DateTime CreatedAt);

public record UgcPaymentDto(
    string Status, long BrandPaidOre, long CreatorAmountOre, long PlatformFeeOre,
    long TransferredOre, long RefundedOre, DateTime? HeldAt, DateTime? TransferredAt, DateTime? RefundedAt, string? LastError);

public record UgcDisputeDto(
    Guid Id, string OpenedBy, string Reason, string Status, string? Decision, int? CreatorSharePercent,
    string? AdminReasoning, DateTime CreatedAt, DateTime? ResolvedAt);

public record UgcMessageDto(
    Guid Id, Guid SenderUserId, string SenderRole, string SenderName, string Body, string? AttachmentUrl,
    bool IsRead, DateTime CreatedAt);

public record UgcCollabEventDto(string? From, string To, string Actor, string? Note, DateTime At);

public record UgcCollabListDto(
    Guid Id, Guid? CampaignId, string Title, string Status, string Compensation,
    long AgreedAmountOre, long PlatformFeeOre, long BrandTotalOre,
    Guid BrandProfileId, string BrandName, string? BrandLogoUrl,
    Guid CreatorProfileId, string CreatorName, string? CreatorAvatarUrl,
    DateTime? DeadlineAt, DateTime? AutoApproveAt, int RevisionCount, int MaxRevisions,
    int DeliverableCount, int UnreadMessages, bool NeedsMyAction, bool Funded,
    DateTime CreatedAt, DateTime UpdatedAt);

public record UgcCollabDetailDto(
    Guid Id, Guid? CampaignId, Guid? ApplicationId, string Title, string BriefSnapshot, string Status, string Compensation,
    long AgreedAmountOre, long PlatformFeeOre, long BrandTotalOre, decimal FeePercentApplied,
    string? ProductDescription, long? ProductValueOre, string RightsPackage,
    int DeadlineDays, DateTime? DeadlineAt, DateTime? AutoApproveAt,
    DateTime? SubmittedAt, DateTime? ApprovedAt, DateTime? PaidAt, DateTime? CancelledAt, string? CancelReason, bool NoShow,
    string ContractText, string ContractHash, string ContractTemplateVersion, DateTime? BrandAcceptedAt, DateTime? CreatorAcceptedAt,
    int RevisionCount, int MaxRevisions, int? BrandRating, bool LicenseAvailable,
    Guid BrandProfileId, string BrandName, string? BrandLogoUrl, Guid BrandUserId,
    Guid CreatorProfileId, string CreatorName, string? CreatorAvatarUrl, Guid CreatorUserId,
    UgcPaymentDto? Payment, UgcDisputeDto? Dispute,
    List<UgcDeliverableDto> Deliverables, List<UgcCollabEventDto> Events,
    /// <summary>What the viewer may do right now — the UI renders exactly these buttons.</summary>
    List<string> AvailableActions,
    int UnreadMessages, DateTime CreatedAt, DateTime UpdatedAt);

public record DirectInviteRequest(
    Guid CreatorProfileId, string Title, UgcBriefDto Brief,
    string Compensation, long AmountOre, string? ProductDescription, long? ProductValueOre,
    string RightsPackage, int DeadlineDays);

/// <summary>What the brand gets back after accepting: either a checkout to pay, or nothing left to do.</summary>
public record UgcCheckoutDto(string? Url, bool Funded, bool ProductExchange, string? Message);

public record RequestUgcRevisionRequest(string Feedback);
public record OpenUgcDisputeRequest(string Reason);
public record CancelUgcCollabRequest(string? Reason);
public record SendUgcMessageRequest(string Body, string? AttachmentUrl);
public record RateUgcCollabRequest(int Rating);

// ── Admin ──────────────────────────────────────────────────────────
public record ResolveUgcDisputeRequest(string Decision, int? CreatorSharePercent, string Reasoning);
public record SetUgcCreatorStatusRequest(string Status, string? Note);

public record UgcAdminCreatorRowDto(
    Guid CreatorProfileId, Guid UserId, string DisplayName, string? AvatarUrl, string Email, string? TikTokUsername,
    string Status, string? StatusNote, int Strikes, int FollowerSnapshot, decimal LikeFollowerRatio,
    string[] Categories, string? City, string? SampleVideoUrl, bool PayoutOnboardingComplete,
    int DeliveredCount, decimal AverageRating, DateTime CreatedAt);

public record UgcAdminDisputeRowDto(
    Guid DisputeId, Guid CollabId, string Title, string BrandName, string CreatorName,
    string OpenedBy, string Reason, string Status, string? Decision, int? CreatorSharePercent,
    long AgreedAmountOre, long BrandPaidOre, DateTime OpenedAt, DateTime? ResolvedAt);

public record UgcAdminOverviewDto(
    int PendingVerification, int VerifiedAwaitingApproval, int OpenDisputes, int ActiveCollabs, int PublishedCampaigns,
    long HeldOre, long PaidOutOre, long FeesEarnedOre,
    decimal FeePercent, int AutoApproveDays, int RevisionDeadlineDays, int MaxRevisions, int StrikesToSuspend,
    int AutoVerifyMinFollowers, decimal AutoVerifyMinLikeFollowerRatio, bool RequireFTaxForPaid,
    bool StripeConfigured, bool StorageConfigured, bool AiConfigured, string ContractTemplateVersion);
