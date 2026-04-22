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
}

public interface IAdminUserService
{
    Task<Result<PagedResult<PendingUserDto>>> GetUsersAsync(string? status, int page, int pageSize);
    Task<Result<PendingUserDto>> ApproveUserAsync(Guid userId, Guid adminId);
    Task<Result<PendingUserDto>> RejectUserAsync(Guid userId, Guid adminId, string reason);
}

public interface IBrandService
{
    Task<Result<BrandProfileDto>> GetProfileAsync(Guid userId);
    Task<Result<BrandProfileDto>> UpdateProfileAsync(Guid userId, UpdateBrandProfileRequest request);
    Task<Result<BrandProfileDto>> CompleteOnboardingAsync(Guid userId, UpdateBrandProfileRequest request);
    Task<Result<PagedResult<BrandListDto>>> ListBrandsAsync(string? status, int page, int pageSize);
    Task<Result<BrandProfileDto>> ApproveBrandAsync(Guid brandId, Guid adminId);
    Task<Result<BrandProfileDto>> RejectBrandAsync(Guid brandId, Guid adminId, string reason);
}

public interface ICreatorService
{
    Task<Result<CreatorProfileDto>> GetProfileAsync(Guid userId);
    Task<Result<CreatorProfileDto>> UpdateProfileAsync(Guid userId, UpdateCreatorProfileRequest request);
    Task<Result<PagedResult<CreatorListDto>>> ListCreatorsAsync(string? status, string? category, int page, int pageSize);
    Task<Result<CreatorProfileDto>> ApproveCreatorAsync(Guid creatorId, Guid adminId);
    Task<Result<CreatorProfileDto>> RejectCreatorAsync(Guid creatorId, Guid adminId, string reason);
}

public interface ICampaignService
{
    Task<Result<CampaignDetailDto>> CreateCampaignAsync(Guid brandUserId, CreateCampaignRequest request, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> UpdateCampaignAsync(Guid campaignId, Guid brandUserId, UpdateCampaignRequest request, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> PublishCampaignAsync(Guid campaignId, Guid brandUserId, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> PauseCampaignAsync(Guid campaignId, Guid userId, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> ResumeCampaignAsync(Guid campaignId, Guid userId, CancellationToken ct = default);
    Task<Result<CampaignDetailDto>> GetCampaignAsync(Guid campaignId, CancellationToken ct = default);
    Task<Result<PagedResult<CampaignListDto>>> ListBrandCampaignsAsync(Guid brandUserId, string? status, int page, int pageSize, CancellationToken ct = default);
    Task<Result<PagedResult<CampaignBrowseDto>>> BrowseCampaignsAsync(string? category, string? country, int page, int pageSize, CancellationToken ct = default);
    Task<Result<CursorPagedResult<CampaignBrowseDto>>> BrowseCampaignsWithCursorAsync(string? category, string? country, string? cursor, int pageSize, CancellationToken ct = default);
    Task<Result<CampaignAnalyticsDto>> GetCampaignAnalyticsAsync(Guid campaignId, Guid brandUserId, CancellationToken ct = default);
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

public interface IAssignmentService
{
    Task<Result<AssignmentDetailDto>> GetAssignmentAsync(Guid assignmentId, Guid userId, CancellationToken ct = default);
    Task<Result<PagedResult<AssignmentListDto>>> GetCreatorAssignmentsAsync(Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default);
    Task<Result<SubmissionDto>> SubmitVideoAsync(Guid assignmentId, Guid creatorUserId, SubmitVideoRequest request, CancellationToken ct = default);
    Task<Result<TrackingTagDto>> GetTrackingTagAsync(Guid assignmentId, Guid creatorUserId, CancellationToken ct = default);
    Task<Result<SubmissionDto>> ApproveSubmissionAsync(Guid submissionId, Guid brandUserId, CancellationToken ct = default);
    Task<Result<SubmissionDto>> RejectSubmissionAsync(Guid submissionId, Guid brandUserId, string? reason, CancellationToken ct = default);
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

public interface INotificationService
{
    Task SendAsync(Guid recipientId, NotificationType type, string message, Guid? referenceId = null);
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
