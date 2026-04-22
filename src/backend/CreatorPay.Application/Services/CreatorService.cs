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
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<TikTokAccount> _tiktokAccounts;
    private readonly IUnitOfWork _uow;

    public CreatorService(
        IRepository<CreatorProfile> creators,
        IRepository<TikTokAccount> tiktokAccounts,
        IUnitOfWork uow)
    {
        _creators = creators;
        _tiktokAccounts = tiktokAccounts;
        _uow = uow;
    }

    public async Task<Result<CreatorProfileDto>> GetProfileAsync(Guid userId)
    {
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == userId);
        if (creator == null) return Errors.NotFound("Creator profile");

        return MapToDto(creator);
    }

    public async Task<Result<CreatorProfileDto>> UpdateProfileAsync(Guid userId, UpdateCreatorProfileRequest request)
    {
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == userId);
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

        // Update or create TikTok account
        if (!string.IsNullOrWhiteSpace(request.TikTokUsername))
        {
            var tiktokUsername = request.TikTokUsername.TrimStart('@');
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
            c.ProfileTags?.ToList() ?? []);
}
