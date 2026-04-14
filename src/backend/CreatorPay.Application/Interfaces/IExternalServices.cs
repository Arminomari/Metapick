namespace CreatorPay.Application.Interfaces;

/// <summary>
/// Abstraktion för TikTok API-integrationen.
/// Integration-dependent: kräver TikTok Login Kit OAuth-tokens.
/// </summary>
public interface ITikTokApiClient
{
    Task<TikTokAuthResult> ExchangeCodeForTokenAsync(string code, string redirectUri, string codeVerifier);
    Task<TikTokTokenRefreshResult> RefreshTokenAsync(string refreshToken);
    Task<TikTokUserInfo> GetUserInfoAsync(string accessToken);
    Task<List<TikTokVideo>> GetUserVideosAsync(string accessToken, DateTime? since, int maxResults = 50);
}

public record TikTokAuthResult(
    string AccessToken, string RefreshToken, int ExpiresIn, string OpenId, string Scope);

public record TikTokTokenRefreshResult(
    string AccessToken, string RefreshToken, int ExpiresIn);

public record TikTokUserInfo(
    string OpenId, string UnionId, string DisplayName,
    string AvatarUrl, int FollowerCount, string Username);

public record TikTokVideo(
    string Id, string Title, string? Description, int Duration,
    string CoverImageUrl, string ShareUrl, DateTime CreateTime,
    long ViewCount, long LikeCount, long CommentCount, long ShareCount);

/// <summary>
/// Abstraktion för utbetalningsleverantör.
/// Implementeras med Stripe, PayPal, manuell bank-transfer, etc.
/// </summary>
public interface IPayoutProvider
{
    string ProviderName { get; }
    Task<PayoutProviderResult> InitiatePayoutAsync(decimal amount, string currency, string recipientDetails);
    Task<PayoutProviderStatus> CheckStatusAsync(string externalTransactionId);
}

public record PayoutProviderResult(bool Success, string? ExternalTransactionId, string? ErrorMessage);
public record PayoutProviderStatus(string Status, DateTime? CompletedAt, string? FailureReason);
