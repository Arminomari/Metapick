using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// Server-side verification of social login tokens.
/// Google: ID token via the tokeninfo endpoint. Apple: identity token against Apple's JWKS.
/// Facebook: access token via debug_token + Graph /me.
/// Providers are enabled by setting GOOGLE_CLIENT_ID, APPLE_CLIENT_ID, FACEBOOK_APP_ID + FACEBOOK_APP_SECRET.
/// </summary>
public class SocialTokenVerifier : ISocialTokenVerifier
{
    private readonly HttpClient _http;
    private readonly ILogger<SocialTokenVerifier> _logger;
    private readonly string? _googleClientId;
    private readonly string? _appleClientId;
    private readonly string? _facebookAppId;
    private readonly string? _facebookAppSecret;

    // Apple's signing keys rotate rarely; cache them across requests.
    private static JsonWebKeySet? _appleJwks;
    private static DateTime _appleJwksFetchedAt = DateTime.MinValue;

    public SocialTokenVerifier(HttpClient http, IConfiguration config, ILogger<SocialTokenVerifier> logger)
    {
        _http = http;
        _logger = logger;
        _googleClientId = FirstNonEmpty(config["GOOGLE_CLIENT_ID"], config["SocialAuth:GoogleClientId"]);
        _appleClientId = FirstNonEmpty(config["APPLE_CLIENT_ID"], config["SocialAuth:AppleClientId"]);
        _facebookAppId = FirstNonEmpty(config["FACEBOOK_APP_ID"], config["SocialAuth:FacebookAppId"]);
        _facebookAppSecret = FirstNonEmpty(config["FACEBOOK_APP_SECRET"], config["SocialAuth:FacebookAppSecret"]);
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    // Client IDs / app IDs are OAuth *public* identifiers — every SPA ships them to the
    // browser to initialize the provider SDKs. Secrets (FACEBOOK_APP_SECRET) never leave here.
    public SocialProvidersDto GetProviders() => new(
        new SocialProviderInfo(_googleClientId != null, _googleClientId),
        new SocialProviderInfo(_appleClientId != null, _appleClientId),
        new SocialProviderInfo(_facebookAppId != null && _facebookAppSecret != null, _facebookAppId));

    public async Task<Result<SocialIdentity>> VerifyAsync(string provider, string token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 8192)
            return Errors.Validation("Ogiltig inloggningstoken");

        try
        {
            return provider switch
            {
                "Google" => await VerifyGoogleAsync(token),
                "Apple" => await VerifyAppleAsync(token),
                "Facebook" => await VerifyFacebookAsync(token),
                _ => Errors.Validation("Okänd inloggningsleverantör"),
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Social token verification failed for provider {Provider}", provider);
            return Errors.Unauthorized("Inloggningen kunde inte verifieras. Försök igen.");
        }
    }

    // ── Google ────────────────────────────────────────────────
    private sealed class GoogleTokenInfo
    {
        [JsonPropertyName("aud")] public string? Aud { get; set; }
        [JsonPropertyName("sub")] public string? Sub { get; set; }
        [JsonPropertyName("email")] public string? Email { get; set; }
        [JsonPropertyName("email_verified")] public string? EmailVerified { get; set; }
        [JsonPropertyName("given_name")] public string? GivenName { get; set; }
        [JsonPropertyName("family_name")] public string? FamilyName { get; set; }
        [JsonPropertyName("picture")] public string? Picture { get; set; }
    }

    private async Task<Result<SocialIdentity>> VerifyGoogleAsync(string idToken)
    {
        if (_googleClientId == null)
            return Errors.Validation("Google-inloggning är inte aktiverad");

        // Google validates signature + expiry server-side; we check audience and email.
        var res = await _http.GetAsync(
            $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}");
        if (!res.IsSuccessStatusCode)
            return Errors.Unauthorized("Google-inloggningen kunde inte verifieras");

        var info = await res.Content.ReadFromJsonAsync<GoogleTokenInfo>();
        if (info?.Sub == null || info.Email == null || info.Aud != _googleClientId)
            return Errors.Unauthorized("Google-inloggningen kunde inte verifieras");

        return new SocialIdentity("Google", info.Sub, info.Email,
            string.Equals(info.EmailVerified, "true", StringComparison.OrdinalIgnoreCase),
            info.GivenName, info.FamilyName, info.Picture);
    }

    // ── Apple ─────────────────────────────────────────────────
    private async Task<Result<SocialIdentity>> VerifyAppleAsync(string identityToken)
    {
        if (_appleClientId == null)
            return Errors.Validation("Apple-inloggning är inte aktiverad");

        if (_appleJwks == null || DateTime.UtcNow - _appleJwksFetchedAt > TimeSpan.FromHours(12))
        {
            var keysJson = await _http.GetStringAsync("https://appleid.apple.com/auth/keys");
            _appleJwks = new JsonWebKeySet(keysJson);
            _appleJwksFetchedAt = DateTime.UtcNow;
        }

        var handler = new JwtSecurityTokenHandler();
        var principal = handler.ValidateToken(identityToken, new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "https://appleid.apple.com",
            ValidateAudience = true,
            ValidAudience = _appleClientId,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = _appleJwks.Keys,
            RequireSignedTokens = true,
            ValidateLifetime = true,
        }, out _);

        var sub = principal.FindFirst("sub")?.Value;
        var email = principal.FindFirst("email")?.Value;
        var emailVerifiedClaim = principal.FindFirst("email_verified")?.Value;
        if (sub == null || email == null)
            return Errors.Unauthorized("Apple-inloggningen kunde inte verifieras");

        // Apple sends the user's name only once, in the authorization response —
        // the client passes it through the register payload instead.
        return new SocialIdentity("Apple", sub, email,
            emailVerifiedClaim == null || string.Equals(emailVerifiedClaim, "true", StringComparison.OrdinalIgnoreCase),
            null, null, null);
    }

    // ── Facebook ──────────────────────────────────────────────
    private async Task<Result<SocialIdentity>> VerifyFacebookAsync(string accessToken)
    {
        if (_facebookAppId == null || _facebookAppSecret == null)
            return Errors.Validation("Facebook-inloggning är inte aktiverad");

        var debugRes = await _http.GetAsync(
            $"https://graph.facebook.com/debug_token?input_token={Uri.EscapeDataString(accessToken)}" +
            $"&access_token={Uri.EscapeDataString($"{_facebookAppId}|{_facebookAppSecret}")}");
        if (!debugRes.IsSuccessStatusCode)
            return Errors.Unauthorized("Facebook-inloggningen kunde inte verifieras");

        using var debugDoc = JsonDocument.Parse(await debugRes.Content.ReadAsStringAsync());
        if (!debugDoc.RootElement.TryGetProperty("data", out var data)
            || !data.TryGetProperty("is_valid", out var isValid) || !isValid.GetBoolean()
            || !data.TryGetProperty("app_id", out var appId) || appId.GetString() != _facebookAppId)
            return Errors.Unauthorized("Facebook-inloggningen kunde inte verifieras");

        var meRes = await _http.GetAsync(
            "https://graph.facebook.com/v19.0/me?fields=id,email,first_name,last_name,picture.width(256)" +
            $"&access_token={Uri.EscapeDataString(accessToken)}");
        if (!meRes.IsSuccessStatusCode)
            return Errors.Unauthorized("Facebook-inloggningen kunde inte verifieras");

        using var meDoc = JsonDocument.Parse(await meRes.Content.ReadAsStringAsync());
        var root = meDoc.RootElement;
        var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        var email = root.TryGetProperty("email", out var emailEl) ? emailEl.GetString() : null;
        if (id == null) return Errors.Unauthorized("Facebook-inloggningen kunde inte verifieras");
        if (string.IsNullOrWhiteSpace(email))
            return Errors.Validation("Ditt Facebook-konto saknar e-postadress — använd e-postregistrering i stället");

        string? first = root.TryGetProperty("first_name", out var f) ? f.GetString() : null;
        string? last = root.TryGetProperty("last_name", out var l) ? l.GetString() : null;
        string? picture = root.TryGetProperty("picture", out var pic)
            && pic.TryGetProperty("data", out var picData)
            && picData.TryGetProperty("url", out var url) ? url.GetString() : null;

        // Facebook only exposes verified emails through the Graph API.
        return new SocialIdentity("Facebook", id, email, true, first, last, picture);
    }
}
