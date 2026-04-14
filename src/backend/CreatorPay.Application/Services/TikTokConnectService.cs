using CreatorPay.Application.Common;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace CreatorPay.Application.Services;

public class TikTokSettings
{
    public string ClientKey { get; set; } = "";
    public string RedirectUri { get; set; } = "";
}

/// <summary>Thread-safe in-memory store for PKCE code verifiers (userId → verifier).</summary>
public static class PkceStore
{
    private static readonly ConcurrentDictionary<Guid, (string Verifier, DateTime Expires)> _store = new();

    public static void Set(Guid userId, string verifier)
    {
        _store[userId] = (verifier, DateTime.UtcNow.AddMinutes(10));
        // Cleanup expired entries
        foreach (var kv in _store)
            if (kv.Value.Expires < DateTime.UtcNow)
                _store.TryRemove(kv.Key, out _);
    }

    public static string? Get(Guid userId)
    {
        if (_store.TryRemove(userId, out var entry) && entry.Expires > DateTime.UtcNow)
            return entry.Verifier;
        return null;
    }
}

public class TikTokConnectService : ITikTokConnectService
{
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<TikTokAccount> _tiktokAccounts;
    private readonly IUnitOfWork _uow;
    private readonly ITikTokApiClient _tikTok;
    private readonly IEncryptionService _encryption;
    private readonly IAuditService _audit;
    private readonly ILogger<TikTokConnectService> _logger;
    private readonly TikTokSettings _settings;

    public TikTokConnectService(
        IRepository<CreatorProfile> creators,
        IRepository<TikTokAccount> tiktokAccounts,
        IUnitOfWork uow,
        ITikTokApiClient tikTok,
        IEncryptionService encryption,
        IAuditService audit,
        ILogger<TikTokConnectService> logger,
        TikTokSettings settings)
    {
        _creators = creators;
        _tiktokAccounts = tiktokAccounts;
        _uow = uow;
        _tikTok = tikTok;
        _encryption = encryption;
        _audit = audit;
        _logger = logger;
        _settings = settings;
    }

    public string GetAuthorizationUrl(Guid userId)
    {
        var scopes = "user.info.profile,user.info.stats,video.list";
        var state = Convert.ToBase64String(userId.ToByteArray());

        // PKCE: generate code_verifier and code_challenge
        var codeVerifier = GenerateCodeVerifier();
        var codeChallenge = GenerateCodeChallenge(codeVerifier);
        PkceStore.Set(userId, codeVerifier);

        return $"https://www.tiktok.com/v2/auth/authorize/" +
               $"?client_key={Uri.EscapeDataString(_settings.ClientKey)}" +
               $"&scope={Uri.EscapeDataString(scopes)}" +
               $"&response_type=code" +
               $"&redirect_uri={Uri.EscapeDataString(_settings.RedirectUri)}" +
               $"&state={Uri.EscapeDataString(state)}" +
               $"&code_challenge={Uri.EscapeDataString(codeChallenge)}" +
               $"&code_challenge_method=S256";
    }

    private static string GenerateCodeVerifier()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string GenerateCodeChallenge(string verifier)
    {
        var hash = SHA256.HashData(Encoding.ASCII.GetBytes(verifier));
        return Convert.ToBase64String(hash)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public async Task<Result<TikTokConnectResult>> HandleCallbackAsync(Guid userId, string code)
    {
        var profile = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (profile == null)
            return Errors.NotFound("Creator profile not found");

        try
        {
            var codeVerifier = PkceStore.Get(userId);
            if (codeVerifier == null)
            {
                _logger.LogWarning("No PKCE code_verifier found for user {UserId}", userId);
                return Errors.Validation("OAuth-sessionen har gått ut. Försök ansluta igen.");
            }

            var authResult = await _tikTok.ExchangeCodeForTokenAsync(code, _settings.RedirectUri, codeVerifier);
            var userInfo = await _tikTok.GetUserInfoAsync(authResult.AccessToken);

            // Update or create TikTok account
            var existing = profile.TikTokAccount;
            if (existing != null)
            {
                existing.TikTokUserId = userInfo.OpenId;
                existing.TikTokUsername = userInfo.Username;
                existing.DisplayName = userInfo.DisplayName;
                existing.AvatarUrl = userInfo.AvatarUrl;
                existing.FollowerCount = userInfo.FollowerCount;
                existing.AccessTokenEncrypted = _encryption.Encrypt(authResult.AccessToken);
                existing.RefreshTokenEncrypted = _encryption.Encrypt(authResult.RefreshToken);
                existing.TokenExpiresAt = DateTime.UtcNow.AddSeconds(authResult.ExpiresIn);
                existing.Scopes = authResult.Scope;
                existing.IsActive = true;
                existing.ConnectedAt = DateTime.UtcNow;
            }
            else
            {
                var account = new TikTokAccount
                {
                    CreatorProfileId = profile.Id,
                    TikTokUserId = userInfo.OpenId,
                    TikTokUsername = userInfo.Username,
                    DisplayName = userInfo.DisplayName,
                    AvatarUrl = userInfo.AvatarUrl,
                    FollowerCount = userInfo.FollowerCount,
                    AccessTokenEncrypted = _encryption.Encrypt(authResult.AccessToken),
                    RefreshTokenEncrypted = _encryption.Encrypt(authResult.RefreshToken),
                    TokenExpiresAt = DateTime.UtcNow.AddSeconds(authResult.ExpiresIn),
                    Scopes = authResult.Scope,
                    IsActive = true,
                    ConnectedAt = DateTime.UtcNow
                };
                _tiktokAccounts.Add(account);
            }

            await _uow.SaveChangesAsync();
            await _audit.LogAsync(userId, "TikTok.Connected", "CreatorProfile", profile.Id);

            _logger.LogInformation("TikTok connected for user {UserId}: @{Username} ({Followers} followers)",
                userId, userInfo.Username, userInfo.FollowerCount);

            return new TikTokConnectResult(userInfo.Username, userInfo.DisplayName, userInfo.FollowerCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TikTok OAuth callback failed for user {UserId}", userId);
            return Errors.Validation($"Kunde inte ansluta TikTok: {ex.Message}");
        }
    }

    public async Task<Result<TikTokConnectionStatus>> GetConnectionStatusAsync(Guid userId)
    {
        var profile = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (profile == null)
            return Errors.NotFound("Creator profile not found");

        var tt = profile.TikTokAccount;
        if (tt == null || !tt.IsActive)
            return new TikTokConnectionStatus(false, null, null, null, null, null);

        return new TikTokConnectionStatus(
            Connected: true,
            Username: tt.TikTokUsername,
            DisplayName: tt.DisplayName,
            FollowerCount: tt.FollowerCount,
            ConnectedAt: tt.ConnectedAt,
            LastSyncAt: tt.LastSyncAt,
            IsOAuth: tt.Scopes != "manual" && !string.IsNullOrEmpty(tt.AccessTokenEncrypted));
    }

    public async Task<Result<bool>> DisconnectAsync(Guid userId)
    {
        var profile = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (profile?.TikTokAccount == null)
            return Errors.NotFound("No TikTok account connected");

        profile.TikTokAccount.IsActive = false;
        profile.TikTokAccount.AccessTokenEncrypted = "";
        profile.TikTokAccount.RefreshTokenEncrypted = "";

        await _uow.SaveChangesAsync();
        await _audit.LogAsync(userId, "TikTok.Disconnected", "CreatorProfile", profile.Id);

        return true;
    }
}
