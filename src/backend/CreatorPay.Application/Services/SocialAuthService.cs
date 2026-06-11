using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

public class SocialAuthService : ISocialAuthService
{
    private readonly ISocialTokenVerifier _verifier;
    private readonly IAuthService _auth;
    private readonly IRepository<User> _users;
    private readonly IUnitOfWork _uow;
    private readonly ITokenService _tokenService;
    private readonly IAuditService _audit;

    public SocialAuthService(
        ISocialTokenVerifier verifier,
        IAuthService auth,
        IRepository<User> users,
        IUnitOfWork uow,
        ITokenService tokenService,
        IAuditService audit)
    {
        _verifier = verifier;
        _auth = auth;
        _users = users;
        _uow = uow;
        _tokenService = tokenService;
        _audit = audit;
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
            request.Industry, request.LogoUrl, request.Description);

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
}
