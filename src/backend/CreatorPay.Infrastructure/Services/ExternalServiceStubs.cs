using CreatorPay.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// TikTok API v2 klient — riktig implementation mot TikTok Login Kit / Content API.
/// Dokumentation: https://developers.tiktok.com/doc/login-kit-web
/// </summary>
public class TikTokApiClient : ITikTokApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<TikTokApiClient> _logger;
    private readonly string _clientKey;
    private readonly string _clientSecret;
    private readonly string _redirectUri;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public TikTokApiClient(HttpClient http, ILogger<TikTokApiClient> logger, IConfiguration config)
    {
        _http = http;
        _logger = logger;
        _clientKey = config["TikTok:ClientKey"] ?? "";
        _clientSecret = config["TikTok:ClientSecret"] ?? "";
        _redirectUri = config["TikTok:RedirectUri"] ?? "";
    }

    public async Task<TikTokAuthResult> ExchangeCodeForTokenAsync(string code, string redirectUri, string codeVerifier)
    {
        _logger.LogInformation("TikTok: exchanging authorization code for tokens");

        var payload = new Dictionary<string, string>
        {
            ["client_key"] = _clientKey,
            ["client_secret"] = _clientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = redirectUri,
            ["code_verifier"] = codeVerifier
        };

        var response = await _http.PostAsync(
            "https://open.tiktokapis.com/v2/oauth/token/",
            new FormUrlEncodedContent(payload));

        var body = await response.Content.ReadAsStringAsync();
        _logger.LogDebug("TikTok token response: {Body}", body);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("TikTok token exchange failed: {Status} {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"TikTok token exchange failed: {response.StatusCode}");
        }

        var json = JsonDocument.Parse(body);
        var root = json.RootElement;

        return new TikTokAuthResult(
            AccessToken: root.GetProperty("access_token").GetString()!,
            RefreshToken: root.GetProperty("refresh_token").GetString()!,
            ExpiresIn: root.GetProperty("expires_in").GetInt32(),
            OpenId: root.GetProperty("open_id").GetString()!,
            Scope: root.GetProperty("scope").GetString()!);
    }

    public async Task<TikTokTokenRefreshResult> RefreshTokenAsync(string refreshToken)
    {
        _logger.LogInformation("TikTok: refreshing access token");

        var payload = new Dictionary<string, string>
        {
            ["client_key"] = _clientKey,
            ["client_secret"] = _clientSecret,
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = refreshToken
        };

        var response = await _http.PostAsync(
            "https://open.tiktokapis.com/v2/oauth/token/",
            new FormUrlEncodedContent(payload));

        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("TikTok token refresh failed: {Status} {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"TikTok token refresh failed: {response.StatusCode}");
        }

        var json = JsonDocument.Parse(body);
        var root = json.RootElement;

        return new TikTokTokenRefreshResult(
            AccessToken: root.GetProperty("access_token").GetString()!,
            RefreshToken: root.GetProperty("refresh_token").GetString()!,
            ExpiresIn: root.GetProperty("expires_in").GetInt32());
    }

    public async Task<TikTokUserInfo> GetUserInfoAsync(string accessToken)
    {
        _logger.LogInformation("TikTok: fetching user info");

        var request = new HttpRequestMessage(HttpMethod.Get,
            "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url,follower_count,username");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _http.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("TikTok user info failed: {Status} {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"TikTok user info failed: {response.StatusCode}");
        }

        var json = JsonDocument.Parse(body);
        var user = json.RootElement.GetProperty("data").GetProperty("user");

        return new TikTokUserInfo(
            OpenId: user.GetProperty("open_id").GetString()!,
            UnionId: user.TryGetProperty("union_id", out var uid) ? uid.GetString() ?? "" : "",
            DisplayName: user.GetProperty("display_name").GetString()!,
            AvatarUrl: user.TryGetProperty("avatar_url", out var av) ? av.GetString() ?? "" : "",
            FollowerCount: user.TryGetProperty("follower_count", out var fc) ? fc.GetInt32() : 0,
            Username: user.TryGetProperty("username", out var un) ? un.GetString() ?? "" : "");
    }

    public async Task<List<TikTokVideo>> GetUserVideosAsync(string accessToken, DateTime? since, int maxResults = 50)
    {
        _logger.LogInformation("TikTok: fetching user videos (since={Since}, max={Max})", since, maxResults);

        var videos = new List<TikTokVideo>();
        long? cursor = null;
        var fields = "id,title,video_description,duration,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count";

        while (videos.Count < maxResults)
        {
            var requestBody = new Dictionary<string, object> { ["max_count"] = Math.Min(20, maxResults - videos.Count) };
            if (cursor.HasValue)
                requestBody["cursor"] = cursor.Value;

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://open.tiktokapis.com/v2/video/list/?fields={fields}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = JsonContent.Create(requestBody);

            var response = await _http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("TikTok video list failed: {Status} {Body}", response.StatusCode, body);
                break;
            }

            var json = JsonDocument.Parse(body);
            var data = json.RootElement.GetProperty("data");

            if (!data.TryGetProperty("videos", out var videosArray) || videosArray.GetArrayLength() == 0)
                break;

            foreach (var v in videosArray.EnumerateArray())
            {
                var createTime = DateTimeOffset.FromUnixTimeSeconds(v.GetProperty("create_time").GetInt64()).UtcDateTime;

                // Skip videos older than the requested date
                if (since.HasValue && createTime < since.Value)
                    continue;

                videos.Add(new TikTokVideo(
                    Id: v.GetProperty("id").GetString()!,
                    Title: v.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
                    Description: v.TryGetProperty("video_description", out var d) ? d.GetString() : null,
                    Duration: v.TryGetProperty("duration", out var dur) ? dur.GetInt32() : 0,
                    CoverImageUrl: v.TryGetProperty("cover_image_url", out var ci) ? ci.GetString() ?? "" : "",
                    ShareUrl: v.TryGetProperty("share_url", out var su) ? su.GetString() ?? "" : "",
                    CreateTime: createTime,
                    ViewCount: v.TryGetProperty("view_count", out var vc) ? vc.GetInt64() : 0,
                    LikeCount: v.TryGetProperty("like_count", out var lc) ? lc.GetInt64() : 0,
                    CommentCount: v.TryGetProperty("comment_count", out var cc) ? cc.GetInt64() : 0,
                    ShareCount: v.TryGetProperty("share_count", out var sc) ? sc.GetInt64() : 0));
            }

            // Pagination
            if (data.TryGetProperty("has_more", out var hasMore) && hasMore.GetBoolean() &&
                data.TryGetProperty("cursor", out var nextCursor))
            {
                cursor = nextCursor.GetInt64();
            }
            else
            {
                break;
            }
        }

        _logger.LogInformation("TikTok: fetched {Count} videos", videos.Count);
        return videos;
    }
}

/// <summary>
/// Payout-provider — stub för MVP. Kopplas till Stripe Connect / banköverföring i V2.
/// </summary>
public class PayoutProviderService : IPayoutProvider
{
    private readonly ILogger<PayoutProviderService> _logger;

    public PayoutProviderService(ILogger<PayoutProviderService> logger) => _logger = logger;

    public string ProviderName => "MockProvider";

    public Task<PayoutProviderResult> InitiatePayoutAsync(decimal amount, string currency, string recipientDetails)
    {
        _logger.LogWarning("Payout: InitiatePayout called for {Amount} {Currency} — returning mock success", amount, currency);
        return Task.FromResult(new PayoutProviderResult(
            true, $"mock_tx_{Guid.NewGuid():N}", null));
    }

    public Task<PayoutProviderStatus> CheckStatusAsync(string externalTransactionId)
    {
        return Task.FromResult(new PayoutProviderStatus("completed", DateTime.UtcNow, null));
    }
}
