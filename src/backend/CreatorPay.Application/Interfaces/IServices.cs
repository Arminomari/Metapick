using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Application.Interfaces;

public interface IAuthService
{
    Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request);
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request);
    Task<Result<AuthResponse>> RefreshTokenAsync(RefreshTokenRequest request);
    Task<Result<bool>> LogoutAsync(Guid userId);
    Task<Result<UserProfileDto>> GetProfileAsync(Guid userId);
    Task<Result<bool>> ChangePasswordAsync(Guid userId, ChangePasswordRequest request);
    Task<Result<bool>> RequestPasswordResetAsync(string email);
    Task<Result<bool>> ResetPasswordAsync(ResetPasswordRequest request);
    Task<Result<bool>> VerifyEmailAsync(VerifyEmailRequest request);
    Task<Result<bool>> ResendVerificationEmailAsync(string email);
    Task<Result<bool>> ChangeEmailAsync(Guid userId, ChangeEmailRequest request);
    Task<Result<bool>> IsEmailAvailableAsync(string email);
    Task<Result<bool>> IsTikTokUsernameAvailableAsync(string username);
}

public interface ISocialAuthService
{
    SocialProvidersDto GetProviders();
    Task<Result<SocialLoginResponse>> LoginAsync(SocialLoginRequest request);
    Task<Result<AuthResponse>> RegisterAsync(SocialRegisterRequest request);
    Result<TikTokStartResponse> StartTikTokSignin();
    Task<Result<TikTokSigninResponse>> TikTokSigninExchangeAsync(TikTokExchangeRequest request);
}

/// <summary>Verified identity returned by a social provider after server-side token validation.</summary>
public record SocialIdentity(string Provider, string ExternalId, string Email, bool EmailVerified,
    string? FirstName, string? LastName, string? PictureUrl);

/// <summary>Validates provider tokens server-side (Google ID token, Apple identity token, Facebook access token).</summary>
public interface ISocialTokenVerifier
{
    SocialProvidersDto GetProviders();
    Task<Result<SocialIdentity>> VerifyAsync(string provider, string token);
}

public interface IAdminUserService
{
    Task<Result<PagedResult<PendingUserDto>>> GetUsersAsync(string? status, int page, int pageSize);
    Task<Result<PendingUserDto>> ApproveUserAsync(Guid userId, Guid adminId);
    Task<Result<PendingUserDto>> RejectUserAsync(Guid userId, Guid adminId, string reason);
    Task<Result<AdminStatsDto>> GetStatsAsync();
    Task<Result<PendingUserDto>> CreateAdminAsync(Guid callerAdminUserId, CreateAdminRequest request);
    Task<Result<int>> BroadcastAsync(Guid callerAdminUserId, BroadcastRequest request);
    Task<Result<AdminCreatorFullDto>> GetCreatorFullProfileAsync(Guid userId);
    Task<Result<bool>> DeleteUserAsync(Guid callerAdminUserId, Guid userId);
}

public interface IBrandService
{
    Task<Result<BrandProfileDto>> GetProfileAsync(Guid userId);
    Task<Result<BrandProfileDto>> UpdateProfileAsync(Guid userId, UpdateBrandProfileRequest request);
    Task<Result<BrandProfileDto>> CompleteOnboardingAsync(Guid userId, UpdateBrandProfileRequest request);
    Task<Result<PagedResult<BrandListDto>>> ListBrandsAsync(string? status, int page, int pageSize);
    Task<Result<BrandProfileDto>> ApproveBrandAsync(Guid brandId, Guid adminId);
    Task<Result<BrandProfileDto>> RejectBrandAsync(Guid brandId, Guid adminId, string reason);
    /// <summary>Re-runs the organisation-number registry check for the brand's own profile.</summary>
    Task<Result<BrandProfileDto>> VerifyOrgAsync(Guid userId);
    /// <summary>Admin sets OrgVerified after seeing documents; the only path besides the registry.</summary>
    Task<Result<BrandProfileDto>> SetOrgVerifiedByAdminAsync(Guid brandId, Guid adminId, bool verified, string? registeredName);
}

public interface ICreatorService
{
    Task<Result<CreatorProfileDto>> GetProfileAsync(Guid userId);
    Task<Result<CreatorProfileDto>> UpdateProfileAsync(Guid userId, UpdateCreatorProfileRequest request);
    Task<Result<PagedResult<CreatorListDto>>> ListCreatorsAsync(string? status, string? category, int page, int pageSize);
    Task<Result<CreatorProfileDto>> ApproveCreatorAsync(Guid creatorId, Guid adminId);
    Task<Result<CreatorProfileDto>> RejectCreatorAsync(Guid creatorId, Guid adminId, string reason);
    Task<Result<PayoutMethodDto>> GetPayoutMethodAsync(Guid userId);
    Task<Result<PayoutMethodDto>> SetPayoutMethodAsync(Guid userId, SetPayoutMethodRequest request);
}

public interface IPortfolioService
{
    Task<Result<List<PortfolioItemDto>>> GetMyPortfolioAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<List<CreatorCollaborationDto>>> GetMyCollaborationsAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<PortfolioItemDto>> AddItemAsync(Guid creatorUserId, CreatePortfolioItemRequest request, CancellationToken ct = default);
    Task<Result<PortfolioItemDto>> UpdateItemAsync(Guid itemId, Guid creatorUserId, UpdatePortfolioItemRequest request, CancellationToken ct = default);
    Task<Result<bool>> DeleteItemAsync(Guid itemId, Guid creatorUserId, CancellationToken ct = default);
}

public interface ICreatorDiscoveryService
{
    Task<Result<PagedResult<CreatorDiscoveryDto>>> SearchAsync(
        string? search, string? category, string? country, int? minFollowers,
        string? tag, bool? openToPrOffers, string? sort, int page, int pageSize,
        long? minVerifiedViews = null, double? minApprovalRate = null, bool? onlyWithResults = null,
        CancellationToken ct = default);
    Task<Result<CreatorPublicProfileDto>> GetPublicProfileAsync(Guid creatorProfileId, CancellationToken ct = default);
}

public interface IPrOfferService
{
    Task<Result<PrOfferDto>> CreateAsync(Guid brandUserId, CreatePrOfferRequest request, CancellationToken ct = default);
    Task<Result<PrOfferDto>> RespondAsync(Guid offerId, Guid creatorUserId, RespondPrOfferRequest request, CancellationToken ct = default);
    Task<Result<PrOfferDto>> WithdrawAsync(Guid offerId, Guid brandUserId, CancellationToken ct = default);
    Task<Result<PrOfferDto>> MarkViewedAsync(Guid offerId, Guid creatorUserId, CancellationToken ct = default);
    Task<Result<PrOfferDto>> GetAsync(Guid offerId, Guid userId, CancellationToken ct = default);
    Task<Result<PagedResult<PrOfferDto>>> GetSentAsync(Guid brandUserId, string? status, string? category, int page, int pageSize, CancellationToken ct = default);
    Task<Result<PagedResult<PrOfferDto>>> GetReceivedAsync(Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default);
    Task<Result<PrOfferStatsDto>> GetBrandStatsAsync(Guid brandUserId, CancellationToken ct = default);
    Task<Result<int>> GetCreatorUnreadCountAsync(Guid creatorUserId, CancellationToken ct = default);
}

public interface ICampaignService
{
    Task<Result<CampaignDetailDto>> CreateCampaignAsync(Guid brandUserId, CreateCampaignRequest request, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> UpdateCampaignAsync(Guid campaignId, Guid brandUserId, UpdateCampaignRequest request, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> PublishCampaignAsync(Guid campaignId, Guid brandUserId, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> PauseCampaignAsync(Guid campaignId, Guid userId, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> ResumeCampaignAsync(Guid campaignId, Guid userId, CancellationToken ct = default);
    /// <summary>Owner and admin see everything; a creator only a browseable campaign or one they take part in.</summary>
    Task<Result<CampaignDetailDto>> GetCampaignAsync(Guid campaignId, Guid userId, string role, CancellationToken ct = default);
    Task<Result<PagedResult<CampaignListDto>>> ListBrandCampaignsAsync(Guid brandUserId, string? status, int page, int pageSize, CancellationToken ct = default);
    Task<Result<PagedResult<CampaignBrowseDto>>> BrowseCampaignsAsync(string? category, string? country, int page, int pageSize, CancellationToken ct = default);
    Task<Result<CursorPagedResult<CampaignBrowseDto>>> BrowseCampaignsWithCursorAsync(string? category, string? country, string? cursor, int pageSize, CancellationToken ct = default);
    Task<Result<CampaignAnalyticsDto>> GetCampaignAnalyticsAsync(Guid campaignId, Guid brandUserId, CancellationToken ct = default);
    Task<Result<MarketBenchmarkDto>> GetMarketBenchmarksAsync(CancellationToken ct = default);
    Task<Result<bool>> SaveCampaignAsync(Guid creatorUserId, Guid campaignId, CancellationToken ct = default);
    Task<Result<bool>> DeleteCampaignAsync(Guid campaignId, Guid brandUserId, CancellationToken ct = default);
    Task<Result<BrandPublicProfileDto>> GetBrandPublicProfileAsync(Guid brandProfileId, Guid viewerUserId, CancellationToken ct = default);
    Task<Result<bool>> SetBrandFollowAsync(Guid viewerUserId, Guid brandProfileId, bool follow, CancellationToken ct = default);
    Task<Result<BrandPostDto>> CreateBrandPostAsync(Guid brandUserId, CreateBrandPostRequest request, CancellationToken ct = default);
    Task<Result<bool>> DeleteBrandPostAsync(Guid brandUserId, Guid postId, CancellationToken ct = default);
    Task<Result<List<FeedPostDto>>> GetFollowedFeedAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<bool>> UnsaveCampaignAsync(Guid creatorUserId, Guid campaignId, CancellationToken ct = default);
    Task<Result<List<SavedCampaignDto>>> GetSavedCampaignsAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<List<Guid>>> GetSavedCampaignIdsAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<PagedResult<AdminCampaignDto>>> ListPendingReviewCampaignsAsync(int page, int pageSize, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> ApproveCampaignAsync(Guid campaignId, Guid adminId, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> RejectCampaignAsync(Guid campaignId, Guid adminId, string reason, CancellationToken ct = default);
}

public interface IApplicationService
{
    Task<Result<ApplicationDto>> ApplyToCampaignAsync(Guid creatorUserId, ApplyToCampaignRequest request, CancellationToken ct = default);
    Task<Result<ApplicationDto>> ApproveApplicationAsync(Guid applicationId, Guid brandUserId, string? note, CancellationToken ct = default);
    Task<Result<ApplicationDto>> RejectApplicationAsync(Guid applicationId, Guid brandUserId, string? reason, CancellationToken ct = default);
    Task<Result<ApplicationDto>> WithdrawApplicationAsync(Guid applicationId, Guid creatorUserId, CancellationToken ct = default);
    Task<Result<PagedResult<ApplicationDto>>> GetCampaignApplicationsAsync(Guid campaignId, Guid brandUserId, string? status, int page, int pageSize, CancellationToken ct = default);
    Task<Result<PagedResult<ApplicationDto>>> GetCreatorApplicationsAsync(Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default);
}

public interface ICommunityService
{
    Task<Result<List<CommunityMemberDto>>> GetMembersAsync(Guid brandUserId, CancellationToken ct = default);
    Task<Result<CommunityMemberDto>> InviteAsync(Guid brandUserId, Guid creatorProfileId, CancellationToken ct = default);
    Task<Result<int>> InviteManyAsync(Guid brandUserId, List<Guid> creatorProfileIds, CancellationToken ct = default);
    Task<Result<bool>> RequestMembershipAsync(Guid creatorUserId, Guid brandProfileId, CancellationToken ct = default);
    Task<Result<bool>> RespondToRequestAsync(Guid brandUserId, Guid creatorProfileId, bool approve, CancellationToken ct = default);
    Task<Result<bool>> RemoveAsync(Guid brandUserId, Guid creatorProfileId, CancellationToken ct = default);
    Task<Result<bool>> LeaveAsync(Guid creatorUserId, Guid brandProfileId, CancellationToken ct = default);
    /// <summary>An invited creator says yes: membership becomes active and every open tap gets an assignment.</summary>
    Task<Result<bool>> AcceptInvitationAsync(Guid creatorUserId, Guid brandProfileId, CancellationToken ct = default);
    Task<Result<bool>> DeclineInvitationAsync(Guid creatorUserId, Guid brandProfileId, CancellationToken ct = default);
    Task<Result<List<MyCommunityDto>>> GetMyCommunitiesAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<BrandCommunityMember> EnsureMemberAsync(Guid brandProfileId, Guid creatorProfileId, CommunityMemberSource source, CancellationToken ct = default);
    Task EnsureTapAssignmentsAsync(Guid brandProfileId, Guid creatorProfileId, CancellationToken ct = default);
}

public interface ITapService
{
    /// <summary>The brand's newest open tap — kept for callers that only know about one.</summary>
    Task<Result<TapDto?>> GetBrandTapAsync(Guid brandUserId, CancellationToken ct = default);
    /// <summary>Every tap the brand has, open ones first.</summary>
    Task<Result<List<TapDto>>> GetBrandTapsAsync(Guid brandUserId, CancellationToken ct = default);
    Task<Result<TapDto>> GetBrandTapByIdAsync(Guid brandUserId, Guid tapId, CancellationToken ct = default);
    Task<Result<TapDto>> CreateTapAsync(Guid brandUserId, UpsertTapRequest request, CancellationToken ct = default);
    Task<Result<TapDto>> UpdateTapAsync(Guid brandUserId, Guid tapId, UpsertTapRequest request, CancellationToken ct = default);
    /// <summary>Legacy: updates the newest tap, or opens the first one.</summary>
    Task<Result<TapDto>> UpsertTapAsync(Guid brandUserId, UpsertTapRequest request, CancellationToken ct = default);
    Task<Result<TapDto>> SetTapStatusAsync(Guid brandUserId, Guid? tapId, bool active, CancellationToken ct = default);
    /// <summary>Closes a tap for good: it disappears for the brand and its creators, history stays.</summary>
    Task<Result<bool>> CloseTapAsync(Guid brandUserId, Guid tapId, CancellationToken ct = default);
    Task<Result<List<CreatorTapDto>>> GetCreatorTapsAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<List<TapSubmissionDto>>> GetTapSubmissionsAsync(Guid brandUserId, CancellationToken ct = default);
}

public interface IAssignmentService
{
    Task<Result<AssignmentDetailDto>> GetAssignmentAsync(Guid assignmentId, Guid userId, CancellationToken ct = default);
    Task<Result<PagedResult<AssignmentListDto>>> GetCreatorAssignmentsAsync(Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default);
    Task<Result<SubmissionDto>> SubmitVideoAsync(Guid assignmentId, Guid creatorUserId, SubmitVideoRequest request, CancellationToken ct = default);
    Task<int> AutoApprovePendingSubmissionsAsync(int olderThanHours, CancellationToken ct = default);
    Task<Result<ActionCountsDto>> GetBrandActionCountsAsync(Guid brandUserId, CancellationToken ct = default);
    Task<Result<ActionCountsDto>> GetCreatorActionCountsAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<List<MyTikTokVideoDto>>> GetMyTikTokVideosAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<TrackingTagDto>> GetTrackingTagAsync(Guid assignmentId, Guid creatorUserId, CancellationToken ct = default);
    Task<Result<SubmissionDto>> ApproveSubmissionAsync(Guid submissionId, Guid brandUserId, CancellationToken ct = default);
    Task<Result<SubmissionDto>> RejectSubmissionAsync(Guid submissionId, Guid brandUserId, string? reason, CancellationToken ct = default);
    Task<Result<bool>> RequestViewRefreshAsync(Guid assignmentId, Guid userId, CancellationToken ct = default);
}

public record LinkClickContext(string? Referrer, string? UserAgent, string? IpHash);
public record LinkRedirectResult(string TargetUrl);

public interface ITrackingLinkService
{
    Task<Result<TrackingLinkDto>> CreateLinkAsync(Guid assignmentId, Guid brandUserId, CreateTrackingLinkRequest request, CancellationToken ct = default);
    Task<Result<List<TrackingLinkDto>>> GetAssignmentLinksAsync(Guid assignmentId, Guid userId, CancellationToken ct = default);
    Task<Result<LinkRedirectResult>> RegisterClickAsync(string code, LinkClickContext context, CancellationToken ct = default);
}

public interface ITikTokConnectService
{
    string GetAuthorizationUrl(Guid userId);
    Task<Result<TikTokConnectResult>> HandleCallbackAsync(Guid userId, string code);
    Task<Result<TikTokConnectionStatus>> GetConnectionStatusAsync(Guid userId);
    Task<Result<bool>> DisconnectAsync(Guid userId);
}

public record TikTokConnectResult(string Username, string DisplayName, int FollowerCount);
public record TikTokConnectionStatus(bool Connected, string? Username, string? DisplayName, int? FollowerCount, DateTime? ConnectedAt, DateTime? LastSyncAt, bool IsOAuth = false);

public interface IPayoutService
{
    Task<Result<PayoutCalculationDto>> GetLatestCalculationAsync(Guid assignmentId, Guid userId, CancellationToken ct = default);
    Task<Result<PayoutRequestDto>> RequestPayoutAsync(Guid creatorUserId, RequestPayoutRequest request, CancellationToken ct = default);
    Task<Result<List<PayableDto>>> GetPayablesAsync(Guid creatorUserId, CancellationToken ct = default);
    Task<Result<PayoutRequestDto>> ApprovePayoutAsync(Guid payoutRequestId, Guid adminUserId, CancellationToken ct = default);
    Task<Result<PayoutRequestDto>> RejectPayoutAsync(Guid payoutRequestId, Guid adminUserId, string reason, CancellationToken ct = default);
    Task<Result<PayoutRequestDto>> MarkManualPayoutSentAsync(Guid assignmentId, Guid brandUserId, CancellationToken ct = default);
    Task<Result<PagedResult<PayoutRequestDto>>> GetCreatorPayoutsAsync(Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default);
    Task<Result<PagedResult<PayoutRequestDto>>> GetAllPayoutsAsync(string? status, int page, int pageSize, CancellationToken ct = default);
}

public interface IFraudService
{
    Task<Result<FraudFlagDto>> CreateFraudFlagAsync(CreateFraudFlagRequest request);
    Task<Result<FraudFlagDto>> ResolveFraudFlagAsync(Guid flagId, Guid adminUserId, ResolveFraudFlagRequest request);
    Task<Result<PagedResult<FraudFlagDto>>> GetFraudFlagsAsync(string? status, string? severity, int page, int pageSize);
}

/// <summary>
/// The one thread each user has with VYRLE's admins: written from the admin
/// table, delivered by mail, answered in the app, read back in the same place.
/// </summary>
public interface ISupportMessageService
{
    Task<Result<List<SupportMessageDto>>> GetThreadForAdminAsync(Guid userId, CancellationToken ct = default);
    Task<Result<SupportMessageDto>> SendFromAdminAsync(Guid adminUserId, Guid userId, SendSupportMessageRequest request, CancellationToken ct = default);
    Task<Result<List<SupportThreadDto>>> GetThreadsAsync(bool unreadOnly, CancellationToken ct = default);

    Task<Result<List<SupportMessageDto>>> GetMyThreadAsync(Guid userId, CancellationToken ct = default);
    Task<Result<SupportMessageDto>> ReplyAsync(Guid userId, SendSupportMessageRequest request, CancellationToken ct = default);
    Task<int> CountUnreadForUserAsync(Guid userId, CancellationToken ct = default);
}

public interface INotificationService
{
    Task SendAsync(Guid recipientId, NotificationType type, string message, Guid? referenceId = null, string? referenceType = null);
    Task<Result<PagedResult<NotificationDto>>> GetNotificationsAsync(Guid userId, bool? unreadOnly, int page, int pageSize);
    Task<Result<bool>> MarkAsReadAsync(Guid notificationId, Guid userId);
    Task<Result<bool>> MarkAllReadAsync(Guid userId);
}

public interface ICampaignSyncTrigger
{
    Task ExecuteAsync();
}

public interface IAuditService
{
    Task LogAsync(Guid userId, string action, string? entityType, Guid? entityId);
    Task<Result<PagedResult<AuditLogDto>>> GetAuditLogsAsync(string? entityType, Guid? entityId, Guid? userId, int page, int pageSize);
}

public interface IReviewService
{
    Task<Result<ReviewDto>> SubmitReviewAsync(Guid assignmentId, Guid reviewerUserId, SubmitReviewRequest request, CancellationToken ct = default);
    Task<Result<UserReviewSummaryDto>> GetReviewsForUserAsync(Guid targetUserId, CancellationToken ct = default);
    Task<Result<ReviewDto?>> GetMyReviewForAssignmentAsync(Guid assignmentId, Guid reviewerUserId, CancellationToken ct = default);
}

public interface IChatService
{
    Task<Result<ChatMessageDto>> SendMessageAsync(string threadId, Guid senderUserId, SendMessageRequest request, CancellationToken ct = default);
    Task<Result<List<ChatMessageDto>>> GetMessagesAsync(string threadId, Guid userId, CancellationToken ct = default);
    Task<Result<bool>> MarkReadAsync(string threadId, Guid userId, CancellationToken ct = default);
    Task<Result<int>> GetUnreadCountAsync(Guid userId, CancellationToken ct = default);
    Task<Result<List<ChatConversationDto>>> GetConversationsAsync(Guid userId, CancellationToken ct = default);
}

public interface ITokenService
{
    Task<AuthResponse> GenerateTokensAsync(User user);
    Task<AuthResponse?> RefreshAsync(string refreshToken);
    Task RevokeAllTokensAsync(Guid userId);
}

public interface IEncryptionService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    string Encrypt(string plainText);
    string Decrypt(string cipherText);
}

public interface IFileStorageService
{
    Task<string> UploadAsync(Stream file, string fileName, string contentType);
    Task<bool> DeleteAsync(string filePath);
}
