using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CreatorPay.Application.Services;

public class SocialAuthService : ISocialAuthService
{
    private readonly ISocialTokenVerifier _verifier;
    private readonly IAuthService _auth;
    private readonly IRepository<User> _users;
    private readonly IUnitOfWork _uow;
    private readonly ITokenService _tokenService;
    private readonly IAuditService _audit;
    private readonly ITikTokApiClient _tikTok;
    private readonly IEncryptionService _encryption;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<TikTokAccount> _tiktokAccounts;
    private readonly TikTokSettings _tikTokSettings;
    private readonly IConfiguration _config;

    public SocialAuthService(
        ISocialTokenVerifier verifier,
        IAuthService auth,
        IRepository<User> users,
        IUnitOfWork uow,
        ITokenService tokenService,
        IAuditService audit,
        ITikTokApiClient tikTok,
        IEncryptionService encryption,
        IRepository<CreatorProfile> creators,
        IRepository<TikTokAccount> tiktokAccounts,
        TikTokSettings tikTokSettings,
        IConfiguration config)
    {
        _verifier = verifier;
        _auth = auth;
        _users = users;
        _uow = uow;
        _tokenService = tokenService;
        _audit = audit;
        _tikTok = tikTok;
        _encryption = encryption;
        _creators = creators;
        _tiktokAccounts = tiktokAccounts;
        _tikTokSettings = tikTokSettings;
        _config = config;
    }

    public SocialProvidersDto GetProviders() => _verifier.GetProviders();

    public async Task<Result<SocialLoginResponse>> LoginAsync(SocialLoginRequest request)
    {
        var verified = await _verifier.VerifyAsync(request.Provider, request.Token);
        if (!verified.IsSuccess) return verified.Error!;
        var identity = verified.Value!;

        if (!identity.EmailVerified)
            return Errors.Validation($"E-postadressen hos {identity.Provider} är inte verifierad");

        var email = identity.Email.ToLowerInvariant();
        var user = await _users.Query().FirstOrDefaultAsync(u =>
                       u.AuthProvider == identity.Provider && u.ExternalAuthId == identity.ExternalId)
                   ?? await _users.Query().FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            return new SocialLoginResponse("NeedsRegistration", null,
                new SocialIdentityDto(identity.Provider, email, identity.FirstName, identity.LastName, identity.PictureUrl));
        }

        if (user.Status == UserStatus.PendingVerification)
            return Errors.Forbidden("Ditt konto väntar på godkännande. Vi hör av oss så snart granskningen är klar.");
        if (user.Status == UserStatus.Suspended)
            return Errors.Forbidden("Kontot är avstängt");
        if (user.Status == UserStatus.Deactivated)
            return Errors.Unauthorized("Fel e-post eller lösenord");

        if (user.AuthProvider == null)
        {
            // A password account exists for this email. Never auto-link: our password
            // accounts have no email-ownership verification, so linking would let whoever
            // registered the address first capture the social user's sessions.
            return Errors.Conflict("Det finns redan ett konto med den här e-postadressen. Logga in med e-post och lösenord i stället.");
        }
        if (user.AuthProvider != identity.Provider || user.ExternalAuthId != identity.ExternalId)
        {
            return Errors.Conflict($"Det här kontot är kopplat till inloggning via {user.AuthProvider}. Använd den i stället.");
        }

        user.LastLoginAt = DateTime.UtcNow;
        await _uow.SaveChangesAsync();
        await _audit.LogAsync(user.Id, $"Auth.SocialLogin.{identity.Provider}", "User", user.Id);

        var tokens = await _tokenService.GenerateTokensAsync(user);
        var auth = new AuthResponse(tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresAt,
            user.Id, user.Email, user.Role.ToString());
        return new SocialLoginResponse("LoggedIn", auth, null);
    }

    public async Task<Result<AuthResponse>> RegisterAsync(SocialRegisterRequest request)
    {
        if (request.Provider.Equals("TikTok", StringComparison.OrdinalIgnoreCase))
            return await RegisterViaTikTokAsync(request);

        var verified = await _verifier.VerifyAsync(request.Provider, request.Token);
        if (!verified.IsSuccess) return verified.Error!;
        var identity = verified.Value!;

        if (!identity.EmailVerified)
            return Errors.Validation($"E-postadressen hos {identity.Provider} är inte verifierad");

        var email = identity.Email.ToLowerInvariant();
        // IgnoreQueryFilters: soft-deleted rows still occupy the unique email index,
        // so they must count as "exists" or the insert 500s on the constraint.
        var exists = await _users.Query().IgnoreQueryFilters().AnyAsync(u =>
            u.Email == email || (u.AuthProvider == identity.Provider && u.ExternalAuthId == identity.ExternalId));
        if (exists)
            return Errors.Conflict("Det finns redan ett konto för den här e-postadressen — logga in i stället");

        // Social accounts never authenticate with a password; store a hash of random
        // bytes so password login can never match.
        var unguessablePassword = Convert.ToBase64String(Guid.NewGuid().ToByteArray())
                                  + Convert.ToBase64String(Guid.NewGuid().ToByteArray());

        var composed = new RegisterRequest(
            email, unguessablePassword, request.Role,
            request.FirstName ?? identity.FirstName, request.LastName ?? identity.LastName,
            request.CompanyName, request.OrganizationNumber, request.ContactPhone,
            request.DisplayName, request.Country, request.Bio, request.Category,
            request.TikTokUsername, request.DateOfBirth, request.ProfileTags,
            request.InstagramUsername,
            request.AvatarUrl ?? identity.PictureUrl, request.FollowerCount, request.AverageViews,
            request.InstagramFollowerCount, request.Website,
            request.Industry, request.LogoUrl, request.Description,
            SelfieUrl: request.SelfieUrl);

        var registered = await _auth.RegisterAsync(composed);
        if (!registered.IsSuccess) return registered;

        var user = await _users.Query().FirstOrDefaultAsync(u => u.Id == registered.Value!.UserId);
        if (user != null)
        {
            user.AuthProvider = identity.Provider;
            user.ExternalAuthId = identity.ExternalId;
            user.EmailVerified = true;
            await _uow.SaveChangesAsync();
            await _audit.LogAsync(user.Id, $"Auth.SocialRegister.{identity.Provider}", "User", user.Id);
        }

        return registered;
    }

    // ── TikTok signin/signup ───────────────────────────────────────────
    // TikTok has no id-token like Google/Apple, so the flow is a full OAuth
    // redirect: /start builds the authorize URL, /exchange trades the code.
    // Existing TikTok-linked account → logged in. Unknown account → the
    // caller gets an encrypted, short-lived ticket that carries the OAuth
    // result into the signup wizard (TikTok provides no email, so the user
    // supplies one there).

    private sealed record TikTokSigninTicket(
        string OpenId, string Username, string? DisplayName, string? AvatarUrl,
        int FollowerCount, string AccessToken, string RefreshToken, int ExpiresIn,
        string Scope, long Exp);

    private string TikTokSigninRedirectUri =>
        (_config["Frontend:BaseUrl"] ?? "https://www.vyrle.co") + "/auth/tiktok/signin";

    public Result<TikTokStartResponse> StartTikTokSignin()
    {
        if (string.IsNullOrWhiteSpace(_tikTokSettings.ClientKey))
            return Errors.Validation("TikTok-inloggning är inte konfigurerad");

        var state = Guid.NewGuid();
        var verifierBytes = RandomNumberGenerator.GetBytes(32);
        var codeVerifier = Convert.ToBase64String(verifierBytes)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        PkceStore.Set(state, codeVerifier);

        var challenge = Convert.ToBase64String(SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier)))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var url = "https://www.tiktok.com/v2/auth/authorize/" +
                  $"?client_key={Uri.EscapeDataString(_tikTokSettings.ClientKey)}" +
                  $"&scope={Uri.EscapeDataString("user.info.profile,user.info.stats,video.list")}" +
                  "&response_type=code" +
                  $"&redirect_uri={Uri.EscapeDataString(TikTokSigninRedirectUri)}" +
                  $"&state={state:N}" +
                  $"&code_challenge={Uri.EscapeDataString(challenge)}" +
                  "&code_challenge_method=S256";

        return new TikTokStartResponse(url);
    }

    public async Task<Result<TikTokSigninResponse>> TikTokSigninExchangeAsync(TikTokExchangeRequest request)
    {
        if (!Guid.TryParseExact(request.State, "N", out var state) && !Guid.TryParse(request.State, out state))
            return Errors.Validation("Ogiltig inloggningssession");
        var codeVerifier = PkceStore.Get(state);
        if (codeVerifier == null)
            return Errors.Validation("Inloggningssessionen har gått ut. Försök igen.");

        TikTokAuthResult tokens;
        TikTokUserInfo info;
        try
        {
            tokens = await _tikTok.ExchangeCodeForTokenAsync(request.Code, TikTokSigninRedirectUri, codeVerifier);
            info = await _tikTok.GetUserInfoAsync(tokens.AccessToken);
        }
        catch (Exception)
        {
            return Errors.Validation("Kunde inte logga in med TikTok. Försök igen.");
        }

        var account = await _tiktokAccounts.Query()
            .Include(t => t.CreatorProfile).ThenInclude(c => c.User)
            .FirstOrDefaultAsync(t => t.TikTokUserId == info.OpenId && t.IsActive && t.Scopes != "manual");

        if (account?.CreatorProfile?.User is { } user)
        {
            if (user.Status == UserStatus.PendingVerification)
                return Errors.Forbidden("Ditt konto väntar på godkännande. Vi hör av oss så snart granskningen är klar.");
            if (user.Status is UserStatus.Suspended or UserStatus.Deactivated)
                return Errors.Forbidden("Kontot är inte aktivt");

            account.AccessTokenEncrypted = _encryption.Encrypt(tokens.AccessToken);
            account.RefreshTokenEncrypted = _encryption.Encrypt(tokens.RefreshToken);
            account.TokenExpiresAt = DateTime.UtcNow.AddSeconds(tokens.ExpiresIn);
            user.LastLoginAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync();
            await _audit.LogAsync(user.Id, "Auth.SocialLogin.TikTok", "User", user.Id);

            var jwt = await _tokenService.GenerateTokensAsync(user);
            return new TikTokSigninResponse("LoggedIn",
                new AuthResponse(jwt.AccessToken, jwt.RefreshToken, jwt.ExpiresAt, user.Id, user.Email, user.Role.ToString()),
                null, null);
        }

        var ticket = new TikTokSigninTicket(
            info.OpenId, info.Username, info.DisplayName, info.AvatarUrl, info.FollowerCount,
            tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresIn, tokens.Scope,
            DateTimeOffset.UtcNow.AddMinutes(20).ToUnixTimeSeconds());

        return new TikTokSigninResponse("NeedsRegistration", null,
            _encryption.Encrypt(JsonSerializer.Serialize(ticket)),
            new SocialIdentityDto("TikTok", "", info.DisplayName, "", info.AvatarUrl));
    }

    private async Task<Result<AuthResponse>> RegisterViaTikTokAsync(SocialRegisterRequest request)
    {
        TikTokSigninTicket? ticket;
        try { ticket = JsonSerializer.Deserialize<TikTokSigninTicket>(_encryption.Decrypt(request.Token)); }
        catch { return Errors.Validation("Ogiltig TikTok-session. Börja om från inloggningssidan."); }
        if (ticket == null || DateTimeOffset.FromUnixTimeSeconds(ticket.Exp) < DateTimeOffset.UtcNow)
            return Errors.Validation("TikTok-sessionen har gått ut. Börja om från inloggningssidan.");

        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            return Errors.Validation("Ange en giltig e-postadress");
        if (!string.Equals(request.Role, "Creator", StringComparison.OrdinalIgnoreCase))
            return Errors.Validation("Registrering via TikTok är endast för creators");

        var openIdTaken = await _tiktokAccounts.Query()
            .AnyAsync(t => t.TikTokUserId == ticket.OpenId && t.IsActive && t.Scopes != "manual");
        if (openIdTaken)
            return Errors.Conflict("Det här TikTok-kontot är redan kopplat till en VYRLE-profil. Logga in i stället.");

        var exists = await _users.Query().IgnoreQueryFilters().AnyAsync(u =>
            u.Email == email || (u.AuthProvider == "TikTok" && u.ExternalAuthId == ticket.OpenId));
        if (exists)
            return Errors.Conflict("Det finns redan ett konto för den här e-postadressen — logga in i stället");

        var unguessablePassword = Convert.ToBase64String(Guid.NewGuid().ToByteArray())
                                  + Convert.ToBase64String(Guid.NewGuid().ToByteArray());

        var composed = new RegisterRequest(
            email, unguessablePassword, "Creator",
            request.FirstName ?? ticket.DisplayName, request.LastName,
            null, null, request.ContactPhone,
            request.DisplayName ?? ticket.DisplayName, request.Country, request.Bio, request.Category,
            string.IsNullOrWhiteSpace(ticket.Username) ? request.TikTokUsername : ticket.Username,
            request.DateOfBirth, request.ProfileTags,
            request.InstagramUsername,
            request.AvatarUrl ?? ticket.AvatarUrl, ticket.FollowerCount, request.AverageViews,
            request.InstagramFollowerCount, request.Website,
            null, null, request.Description);

        var registered = await _auth.RegisterAsync(composed);
        if (!registered.IsSuccess) return registered;

        var user = await _users.Query().FirstOrDefaultAsync(u => u.Id == registered.Value!.UserId);
        if (user != null)
        {
            user.AuthProvider = "TikTok";
            user.ExternalAuthId = ticket.OpenId;

            // Upgrade the manual TikTok stub created at registration to a real
            // OAuth connection with the tokens from the signin flow.
            var creator = await _creators.Query().Include(c => c.TikTokAccount)
                .FirstOrDefaultAsync(c => c.UserId == user.Id);
            if (creator != null)
            {
                var acc = creator.TikTokAccount;
                if (acc == null)
                {
                    acc = new TikTokAccount { CreatorProfileId = creator.Id };
                    _tiktokAccounts.Add(acc);
                }
                acc.TikTokUserId = ticket.OpenId;
                acc.TikTokUsername = ticket.Username;
                acc.DisplayName = ticket.DisplayName;
                acc.AvatarUrl = ticket.AvatarUrl;
                acc.FollowerCount = ticket.FollowerCount;
                acc.AccessTokenEncrypted = _encryption.Encrypt(ticket.AccessToken);
                acc.RefreshTokenEncrypted = _encryption.Encrypt(ticket.RefreshToken);
                acc.TokenExpiresAt = DateTime.UtcNow.AddSeconds(ticket.ExpiresIn);
                acc.Scopes = ticket.Scope;
                acc.IsActive = true;
                acc.ConnectedAt = DateTime.UtcNow;
            }

            await _uow.SaveChangesAsync();
            await _audit.LogAsync(user.Id, "Auth.SocialRegister.TikTok", "User", user.Id);
        }

        return registered;
    }
}
