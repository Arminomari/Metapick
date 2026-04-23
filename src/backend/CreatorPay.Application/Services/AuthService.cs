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

    public AuthService(
        IRepository<User> users,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        IRepository<TikTokAccount> tiktokAccounts,
        IUnitOfWork uow,
        ITokenService tokenService,
        IEncryptionService encryption,
        IAuditService audit)
    {
        _users = users;
        _brands = brands;
        _creators = creators;
        _tiktokAccounts = tiktokAccounts;
        _uow = uow;
        _tokenService = tokenService;
        _encryption = encryption;
        _audit = audit;
    }

    public async Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request)
    {
        var exists = await _users.Query().AnyAsync(u => u.Email == request.Email.ToLowerInvariant());
        if (exists) return Errors.Conflict("Email already registered");

        if (!Enum.TryParse<UserRole>(request.Role, out var role) ||
            role == UserRole.Admin)
            return Errors.Validation("Invalid role");

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
                Industry = "Övrigt",
                Country = request.Country ?? "SE",
                ContactPhone = request.ContactPhone,
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
                Status = CreatorStatus.Pending
            };
            _creators.Add(creator);

            // If TikTok username provided, create a simplified TikTok account record
            if (!string.IsNullOrWhiteSpace(request.TikTokUsername))
            {
                var tiktokUsername = request.TikTokUsername.TrimStart('@');
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

        // Don't issue tokens — account must be approved by admin first
        return new AuthResponse("", "", DateTime.UtcNow,
            user.Id, user.Email, user.Role.ToString());
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
            user.Status.ToString(), profileName, profileStatus, user.LastLoginAt, user.CreatedAt);
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
}
