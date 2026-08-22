using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

public class AuthService : IAuthService
{
    private readonly IRepository<User> _users;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<TikTokAccount> _tiktokAccounts;
    private readonly IUnitOfWork _uow;
    private readonly ITokenService _tokenService;
    private readonly IEncryptionService _encryption;
    private readonly IAuditService _audit;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;

    public AuthService(
        IRepository<User> users,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        IRepository<TikTokAccount> tiktokAccounts,
        IUnitOfWork uow,
        ITokenService tokenService,
        IEncryptionService encryption,
        IAuditService audit,
        IEmailService email,
        IConfiguration config)
    {
        _users = users;
        _brands = brands;
        _creators = creators;
        _tiktokAccounts = tiktokAccounts;
        _uow = uow;
        _tokenService = tokenService;
        _encryption = encryption;
        _audit = audit;
        _email = email;
        _config = config;
    }

    public async Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request)
    {
        // IgnoreQueryFilters: soft-deleted rows still occupy the unique email index,
        // so they must count as "exists" or the insert 500s on the constraint.
        var exists = await _users.Query().IgnoreQueryFilters()
            .AnyAsync(u => u.Email == request.Email.ToLowerInvariant());
        if (exists) return Errors.Conflict("Email already registered");

        if (!Enum.TryParse<UserRole>(request.Role, out var role) ||
            role == UserRole.Admin)
            return Errors.Validation("Invalid role");

        if (!MediaValidation.IsValidImageRef(request.AvatarUrl))
            return Errors.Validation("Profilbilden är ogiltig eller för stor");
        if (!MediaValidation.IsValidImageRef(request.LogoUrl))
            return Errors.Validation("Logotypen är ogiltig eller för stor");

        // For creators, the TikTok username has a unique index — check up front so a
        // collision returns a clean 409 instead of an unhandled DbUpdateException (500).
        var normalizedTikTok = role == UserRole.Creator && !string.IsNullOrWhiteSpace(request.TikTokUsername)
            ? request.TikTokUsername.TrimStart('@').Trim()
            : null;
        if (normalizedTikTok != null)
        {
            var tikTokTaken = await _tiktokAccounts.Query()
                .AnyAsync(t => t.TikTokUsername == normalizedTikTok);
            if (tikTokTaken)
                return Errors.Conflict("Detta TikTok-användarnamn är redan kopplat till ett annat konto");
        }

        var user = new User
        {
            Email = request.Email.ToLowerInvariant(),
            PasswordHash = _encryption.HashPassword(request.Password),
            FirstName = request.FirstName ?? "",
            LastName = request.LastName ?? "",
            Role = role,
            Status = UserStatus.PendingVerification
        };

        _users.Add(user);

        if (role == UserRole.Brand)
        {
            var brand = new BrandProfile
            {
                UserId = user.Id,
                CompanyName = request.CompanyName ?? request.Email,
                OrganizationNumber = request.OrganizationNumber,
                Industry = string.IsNullOrWhiteSpace(request.Industry) ? "Övrigt" : request.Industry.Trim(),
                Country = request.Country ?? "SE",
                ContactPhone = request.ContactPhone,
                Website = TrimOrNull(request.Website, 300),
                Description = TrimOrNull(request.Description, 2000),
                LogoUrl = MediaValidation.Normalize(request.LogoUrl),
                Status = BrandStatus.Pending
            };
            _brands.Add(brand);
        }
        else if (role == UserRole.Creator)
        {
            var creator = new CreatorProfile
            {
                UserId = user.Id,
                DisplayName = request.DisplayName ?? request.Email.Split('@')[0],
                Bio = request.Bio ?? "",
                Category = request.Category ?? "Övrigt",
                Country = request.Country ?? "SE",
                Language = "sv",
                DateOfBirth = request.DateOfBirth,
                ProfileTags = request.ProfileTags?.ToArray() ?? [],
                InstagramUsername = string.IsNullOrWhiteSpace(request.InstagramUsername)
                    ? null : request.InstagramUsername.TrimStart('@').Trim(),
                AvatarUrl = MediaValidation.Normalize(request.AvatarUrl),
                FollowerCount = Math.Max(0, request.FollowerCount ?? 0),
                AverageViews = request.AverageViews is > 0 ? request.AverageViews : null,
                InstagramFollowerCount = Math.Max(0, request.InstagramFollowerCount ?? 0),
                Website = TrimOrNull(request.Website, 300),
                Status = CreatorStatus.Pending
            };
            _creators.Add(creator);

            // TikTok connection is required at sign-up; create the account record.
            if (normalizedTikTok != null)
            {
                var tiktokUsername = normalizedTikTok;
                var tiktok = new TikTokAccount
                {
                    CreatorProfileId = creator.Id,
                    TikTokUserId = tiktokUsername,
                    TikTokUsername = tiktokUsername,
                    DisplayName = request.DisplayName,
                    FollowerCount = 0,
                    AccessTokenEncrypted = "",
                    RefreshTokenEncrypted = "",
                    TokenExpiresAt = DateTime.UtcNow.AddYears(10),
                    Scopes = "manual",
                    IsActive = true,
                    ConnectedAt = DateTime.UtcNow
                };
                _tiktokAccounts.Add(tiktok);
            }
        }

        await _uow.SaveChangesAsync();
        await _audit.LogAsync(user.Id, "Auth.Register", "User", user.Id);

        try { await SendVerificationEmailAsync(user); }
        catch { /* best-effort: registration must never fail on email delivery */ }

        // Don't issue tokens — account must be approved by admin first
        return new AuthResponse("", "", DateTime.UtcNow,
            user.Id, user.Email, user.Role.ToString());
    }

    private static string? TrimOrNull(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length > maxLength ? trimmed[..maxLength] : trimmed;
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request)
    {
        var user = await _users.Query()
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant());

        if (user == null || !_encryption.VerifyPassword(request.Password, user.PasswordHash))
            return Errors.Unauthorized("Invalid email or password");

        if (user.Status == UserStatus.PendingVerification)
            return Errors.Forbidden("Your account is pending approval. Please wait for admin verification.");

        if (user.Status == UserStatus.Suspended)
            return Errors.Forbidden("Account suspended");

        if (user.Status == UserStatus.Deactivated)
            return Errors.Unauthorized("Invalid email or password");

        user.LastLoginAt = DateTime.UtcNow;
        await _uow.SaveChangesAsync();
        await _audit.LogAsync(user.Id, "Auth.Login", "User", user.Id);

        var tokens = await _tokenService.GenerateTokensAsync(user);
        return new AuthResponse(tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresAt,
            user.Id, user.Email, user.Role.ToString());
    }

    public async Task<Result<AuthResponse>> RefreshTokenAsync(RefreshTokenRequest request)
    {
        var result = await _tokenService.RefreshAsync(request.RefreshToken);
        if (result == null)
            return Errors.Unauthorized("Invalid or expired refresh token");

        return result;
    }

    public async Task<Result<bool>> LogoutAsync(Guid userId) 
    {
        await _tokenService.RevokeAllTokensAsync(userId);
        await _audit.LogAsync(userId, "Auth.Logout", "User", userId);
        return true;
    }

    public async Task<Result<UserProfileDto>> GetProfileAsync(Guid userId)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return Errors.NotFound("User", userId);

        string? profileName = null;
        string? profileStatus = null;

        if (user.Role == UserRole.Brand)
        {
            var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId);
            profileName = brand?.CompanyName;
            profileStatus = brand?.Status.ToString();
        }
        else if (user.Role == UserRole.Creator)
        {
            var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId);
            profileName = creator?.DisplayName;
            profileStatus = creator?.Status.ToString();
        }

        return new UserProfileDto(user.Id, user.Email, user.Role.ToString(),
            user.Status.ToString(), profileName, profileStatus, user.LastLoginAt, user.CreatedAt,
            user.EmailVerified);
    }

    public async Task<Result<bool>> ChangePasswordAsync(Guid userId, ChangePasswordRequest request)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return Errors.NotFound("User", userId);

        if (!_encryption.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return Errors.Validation("Current password is incorrect");

        user.PasswordHash = _encryption.HashPassword(request.NewPassword);
        await _uow.SaveChangesAsync();
        await _tokenService.RevokeAllTokensAsync(userId);
        await _audit.LogAsync(userId, "Auth.PasswordChanged", "User", userId);

        return true;
    }

    // ── Password reset: stateless HMAC token bound to the current password
    //    hash, so every link expires in 1h and works exactly once ──────────
    public async Task<Result<bool>> RequestPasswordResetAsync(string email)
    {
        var user = await _users.Query()
            .FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant());

        // Always report success so the endpoint can't be used to probe emails.
        if (user == null || user.Status == UserStatus.Deactivated)
            return true;

        var expiry = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds();
        var token = $"{user.Id:N}.{expiry}.{ComputeResetSignature(user, expiry)}";
        var baseUrl = _config["Frontend:BaseUrl"] ?? "https://www.vyrle.co";
        var link = $"{baseUrl}/reset-password?token={Uri.EscapeDataString(token)}";

        await _email.SendAsync(user.Email, "Återställ ditt lösenord",
            EmailTemplates.Branded(
                "Återställ ditt lösenord",
                $"<p>Hej {WebUtility.HtmlEncode(user.FirstName)}!</p>" +
                "<p>Klicka på knappen nedan för att välja ett nytt lösenord. " +
                "Länken gäller i en timme och kan bara användas en gång.</p>" +
                "<p>Har du inte begärt det här kan du ignorera mejlet.</p>",
                "Välj nytt lösenord", link));

        await _audit.LogAsync(user.Id, "Auth.PasswordResetRequested", "User", user.Id);
        return true;
    }

    public async Task<Result<bool>> ResetPasswordAsync(ResetPasswordRequest request)
    {
        var parts = request.Token.Split('.');
        if (parts.Length != 3
            || !Guid.TryParseExact(parts[0], "N", out var userId)
            || !long.TryParse(parts[1], out var expiry))
            return Errors.Validation("Ogiltig eller utgången återställningslänk");

        if (DateTimeOffset.FromUnixTimeSeconds(expiry) < DateTimeOffset.UtcNow)
            return Errors.Validation("Återställningslänken har gått ut. Begär en ny.");

        var user = await _users.GetByIdAsync(userId);
        if (user == null)
            return Errors.Validation("Ogiltig eller utgången återställningslänk");

        var expected = ComputeResetSignature(user, expiry);
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(parts[2])))
            return Errors.Validation("Ogiltig eller utgången återställningslänk");

        user.PasswordHash = _encryption.HashPassword(request.NewPassword);
        await _uow.SaveChangesAsync();
        await _tokenService.RevokeAllTokensAsync(user.Id);
        await _audit.LogAsync(user.Id, "Auth.PasswordReset", "User", user.Id);
        return true;
    }

    // ── Email verification: stateless HMAC token bound to the address, so a
    //    link stops working if the email ever changes ───────────────────────
    public async Task<Result<bool>> VerifyEmailAsync(VerifyEmailRequest request)
    {
        var parts = request.Token.Split('.');
        if (parts.Length != 3
            || !Guid.TryParseExact(parts[0], "N", out var userId)
            || !long.TryParse(parts[1], out var expiry))
            return Errors.Validation("Ogiltig verifieringslänk");

        var user = await _users.GetByIdAsync(userId);
        if (user == null) return Errors.Validation("Ogiltig verifieringslänk");
        if (user.EmailVerified) return true; // already verified — idempotent success

        if (DateTimeOffset.FromUnixTimeSeconds(expiry) < DateTimeOffset.UtcNow)
            return Errors.Validation("Verifieringslänken har gått ut. Begär en ny.");

        var expected = ComputeVerifySignature(user, expiry);
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(parts[2])))
            return Errors.Validation("Ogiltig verifieringslänk");

        user.EmailVerified = true;
        await _uow.SaveChangesAsync();
        await _audit.LogAsync(user.Id, "Auth.EmailVerified", "User", user.Id);
        return true;
    }

    public async Task<Result<bool>> ResendVerificationEmailAsync(string email)
    {
        var user = await _users.Query()
            .FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant());
        // Always report success so the endpoint can't be used to probe emails.
        if (user == null || user.EmailVerified) return true;
        await SendVerificationEmailAsync(user);
        return true;
    }

    private async Task SendVerificationEmailAsync(User user)
    {
        var expiry = DateTimeOffset.UtcNow.AddDays(7).ToUnixTimeSeconds();
        var token = $"{user.Id:N}.{expiry}.{ComputeVerifySignature(user, expiry)}";
        var baseUrl = _config["Frontend:BaseUrl"] ?? "https://www.vyrle.co";
        var link = $"{baseUrl}/verify-email?token={Uri.EscapeDataString(token)}";

        await _email.SendAsync(user.Email, "Bekräfta din e-postadress",
            EmailTemplates.Branded(
                "Bekräfta din e-postadress",
                $"<p>Hej {WebUtility.HtmlEncode(user.FirstName)}!</p>" +
                "<p>Tryck på knappen nedan för att bekräfta att den här adressen är din. " +
                "Länken gäller i 7 dagar.</p>" +
                "<p>Har du inte skapat ett konto på VYRLE kan du ignorera mejlet.</p>",
                "Bekräfta e-postadress", link));
    }

    private string ComputeVerifySignature(User user, long expiry)
    {
        var secret = _config["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret missing");
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var payload = $"verify|{user.Id:N}|{expiry}|{user.Email}";
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }

    private string ComputeResetSignature(User user, long expiry)
    {
        var secret = _config["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret missing");
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var payload = $"{user.Id:N}|{expiry}|{user.PasswordHash}";
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }
}
