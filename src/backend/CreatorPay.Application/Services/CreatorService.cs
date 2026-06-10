using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

public class CreatorService : ICreatorService
{
    private static readonly string[] AllowedPayoutMethods = ["BankTransfer", "Swish", "PayPal"];

    private readonly IRepository<User> _users;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<TikTokAccount> _tiktokAccounts;
    private readonly IUnitOfWork _uow;
    private readonly IEncryptionService _encryption;

    public CreatorService(
        IRepository<User> users,
        IRepository<CreatorProfile> creators,
        IRepository<TikTokAccount> tiktokAccounts,
        IUnitOfWork uow,
        IEncryptionService encryption)
    {
        _users = users;
        _creators = creators;
        _tiktokAccounts = tiktokAccounts;
        _uow = uow;
        _encryption = encryption;
    }

    public async Task<Result<PayoutMethodDto>> GetPayoutMethodAsync(Guid userId)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId);
        if (creator == null) return Errors.NotFound("Creator profile");
        return BuildPayoutMethodDto(creator);
    }

    public async Task<Result<PayoutMethodDto>> SetPayoutMethodAsync(Guid userId, SetPayoutMethodRequest request)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId);
        if (creator == null) return Errors.NotFound("Creator profile");

        if (!AllowedPayoutMethods.Contains(request.Method))
            return Errors.Validation($"Payout method must be one of: {string.Join(", ", AllowedPayoutMethods)}");

        var details = (request.Details ?? "").Trim();
        if (details.Length < 4 || details.Length > 200)
            return Errors.Validation("Payout details must be between 4 and 200 characters");

        var holder = request.AccountHolder?.Trim();
        if (holder is { Length: > 120 })
            return Errors.Validation("Account holder name is too long");

        var payload = System.Text.Json.JsonSerializer.Serialize(new PayoutDetailsPayload(details, holder));
        creator.PayoutMethod = request.Method;
        creator.PayoutDetailsEncrypted = _encryption.Encrypt(payload);
        creator.UpdatedAt = DateTime.UtcNow;
        await _uow.SaveChangesAsync();

        return BuildPayoutMethodDto(creator);
    }

    private sealed record PayoutDetailsPayload(string Details, string? Holder);

    private PayoutMethodDto BuildPayoutMethodDto(CreatorProfile creator)
    {
        if (string.IsNullOrEmpty(creator.PayoutMethod) || string.IsNullOrEmpty(creator.PayoutDetailsEncrypted))
            return new PayoutMethodDto(creator.PayoutMethod, null, null, false);

        string masked = "••••";
        string? holder = null;
        try
        {
            var json = _encryption.Decrypt(creator.PayoutDetailsEncrypted);
            var payload = System.Text.Json.JsonSerializer.Deserialize<PayoutDetailsPayload>(json);
            if (payload != null)
            {
                var d = payload.Details;
                masked = d.Length <= 4 ? new string('•', d.Length) : new string('•', Math.Min(d.Length - 4, 8)) + d[^4..];
                holder = payload.Holder;
            }
        }
        catch
        {
            // Older/foreign cipher payloads: stay masked rather than erroring the profile page.
        }
        return new PayoutMethodDto(creator.PayoutMethod, masked, holder, true);
    }

    public async Task<Result<CreatorProfileDto>> GetProfileAsync(Guid userId)
    {
        var creator = await GetOrCreateCreatorProfileAsync(userId);
        if (creator == null) return Errors.NotFound("Creator profile");

        return MapToDto(creator);
    }

    public async Task<Result<CreatorProfileDto>> UpdateProfileAsync(Guid userId, UpdateCreatorProfileRequest request)
    {
        var creator = await GetOrCreateCreatorProfileAsync(userId);
        if (creator == null) return Errors.NotFound("Creator profile");

        creator.DisplayName = request.DisplayName;
        creator.Bio = request.Bio;
        creator.Category = request.Category;
        creator.Country = request.Country;
        creator.Language = request.Language;
        if (request.DateOfBirth.HasValue)
            creator.DateOfBirth = request.DateOfBirth;
        if (request.ProfileTags != null)
            creator.ProfileTags = request.ProfileTags.ToArray();
        // Previously these fields were silently dropped on update.
        if (request.AvatarUrl != null)
            creator.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        if (request.FollowerCount.HasValue && request.FollowerCount.Value >= 0)
            creator.FollowerCount = request.FollowerCount.Value;
        if (request.AverageViews.HasValue && request.AverageViews.Value >= 0)
            creator.AverageViews = request.AverageViews.Value;
        if (request.InstagramUsername != null)
            creator.InstagramUsername = string.IsNullOrWhiteSpace(request.InstagramUsername)
                ? null : request.InstagramUsername.TrimStart('@').Trim();
        if (request.InstagramFollowerCount.HasValue && request.InstagramFollowerCount.Value >= 0)
            creator.InstagramFollowerCount = request.InstagramFollowerCount.Value;
        if (request.Website != null)
            creator.Website = string.IsNullOrWhiteSpace(request.Website) ? null : request.Website.Trim();
        if (request.OpenToPrOffers.HasValue)
            creator.OpenToPrOffers = request.OpenToPrOffers.Value;

        // Update or create TikTok account
        if (!string.IsNullOrWhiteSpace(request.TikTokUsername))
        {
            var tiktokUsername = request.TikTokUsername.TrimStart('@').Trim();
            // Unique index on TikTokUsername — block collisions with a clean error (not a 500).
            var takenByOther = await _tiktokAccounts.Query()
                .AnyAsync(t => t.TikTokUsername == tiktokUsername && t.CreatorProfileId != creator.Id);
            if (takenByOther)
                return Errors.Conflict("Detta TikTok-användarnamn är redan kopplat till ett annat konto");
            if (creator.TikTokAccount != null)
            {
                creator.TikTokAccount.TikTokUsername = tiktokUsername;
                creator.TikTokAccount.TikTokUserId = tiktokUsername;
            }
            else
            {
                var tiktok = new TikTokAccount
                {
                    CreatorProfileId = creator.Id,
                    TikTokUserId = tiktokUsername,
                    TikTokUsername = tiktokUsername,
                    DisplayName = creator.DisplayName,
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
        // Re-fetch to get updated TikTok data
        var updated = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == userId);
        if (updated == null) return Errors.NotFound("Creator profile");
        return MapToDto(updated);
    }

    public async Task<Result<PagedResult<CreatorListDto>>> ListCreatorsAsync(string? status, string? category, int page, int pageSize)
    {
        var query = _creators.Query().AsQueryable();
        if (Enum.TryParse<CreatorStatus>(status, out var s))
            query = query.Where(c => c.Status == s);
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(c => c.Category == category);

        var totalCount = await query.CountAsync();
        var items = await query.OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new PagedResult<CreatorListDto>
        {
            Data = items.Select(c => new CreatorListDto(c.Id, c.DisplayName, c.Category, c.Country,
                c.FollowerCount, c.AverageViews, c.Status.ToString(), c.CreatedAt)).ToList(),
            Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<CreatorProfileDto>> ApproveCreatorAsync(Guid creatorId, Guid adminId)
    {
        var creator = await _creators.Query().Include(c => c.TikTokAccount).FirstOrDefaultAsync(c => c.Id == creatorId);
        if (creator == null) return Errors.NotFound("Creator", creatorId);
        creator.Status = CreatorStatus.Approved;
        creator.ReviewedBy = adminId;
        creator.ReviewedAt = DateTime.UtcNow;
        await _uow.SaveChangesAsync();
        return MapToDto(creator);
    }

    public async Task<Result<CreatorProfileDto>> RejectCreatorAsync(Guid creatorId, Guid adminId, string reason)
    {
        var creator = await _creators.Query().Include(c => c.TikTokAccount).FirstOrDefaultAsync(c => c.Id == creatorId);
        if (creator == null) return Errors.NotFound("Creator", creatorId);
        creator.Status = CreatorStatus.Rejected;
        creator.ReviewedBy = adminId;
        creator.ReviewedAt = DateTime.UtcNow;
        creator.RejectionReason = reason;
        await _uow.SaveChangesAsync();
        return MapToDto(creator);
    }

    private static CreatorProfileDto MapToDto(CreatorProfile c) =>
        new(c.Id, c.UserId, c.DisplayName, c.Bio, c.Category, c.Country, c.Language,
            c.AvatarUrl, c.FollowerCount, c.AverageViews, c.Status.ToString(),
            c.TikTokAccount != null && c.TikTokAccount.IsActive,
            c.TikTokAccount?.TikTokUsername, c.CreatedAt,
            c.ProfileTags?.ToList() ?? [],
            c.InstagramUsername, c.InstagramFollowerCount, c.Website, c.OpenToPrOffers);

    private async Task<CreatorProfile?> GetOrCreateCreatorProfileAsync(Guid userId)
    {
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == userId);
        if (creator != null) return creator;

        var user = await _users.GetByIdAsync(userId);
        if (user == null || user.Role != UserRole.Creator) return null;

        var displayName = !string.IsNullOrWhiteSpace(user.FirstName)
            ? user.FirstName
            : user.Email.Split('@')[0];

        var created = new CreatorProfile
        {
            UserId = user.Id,
            DisplayName = displayName,
            Bio = "",
            Category = "Övrigt",
            Country = "SE",
            Language = "sv",
            Status = user.Status == UserStatus.Active ? CreatorStatus.Approved : CreatorStatus.Pending
        };

        _creators.Add(created);
        await _uow.SaveChangesAsync();

        return await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == userId);
    }
}
