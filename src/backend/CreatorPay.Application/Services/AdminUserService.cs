using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

public class AdminUserService : IAdminUserService
{
    private readonly IRepository<User> _users;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<TikTokAccount> _tiktokAccounts;
    private readonly IUnitOfWork _uow;
    private readonly IAuditService _audit;

    public AdminUserService(
        IRepository<User> users,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        IRepository<TikTokAccount> tiktokAccounts,
        IUnitOfWork uow,
        IAuditService audit)
    {
        _users = users;
        _brands = brands;
        _creators = creators;
        _tiktokAccounts = tiktokAccounts;
        _uow = uow;
        _audit = audit;
    }

    public async Task<Result<PagedResult<PendingUserDto>>> GetUsersAsync(string? status, int page, int pageSize)
    {
        var query = _users.Query()
            .Where(u => u.Role != UserRole.Admin);

        if (Enum.TryParse<UserStatus>(status, out var s))
            query = query.Where(u => u.Status == s);

        var orderedQuery = query.OrderByDescending(u => u.CreatedAt);

        var totalCount = await orderedQuery.CountAsync();
        var users = await orderedQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var userIds = users.Select(u => u.Id).ToList();

        // Batch-load profiles to avoid N+1
        var brands = await _brands.Query()
            .Where(b => userIds.Contains(b.UserId))
            .ToListAsync();
        var creators = await _creators.Query()
            .Where(c => userIds.Contains(c.UserId))
            .ToListAsync();
        var creatorIds = creators.Select(c => c.Id).ToList();
        var tiktokAccounts = await _tiktokAccounts.Query()
            .Where(t => creatorIds.Contains(t.CreatorProfileId))
            .ToListAsync();

        // Be defensive against duplicate rows in production data.
        var brandByUser = brands
            .OrderByDescending(b => b.CreatedAt)
            .GroupBy(b => b.UserId)
            .ToDictionary(g => g.Key, g => g.First());
        var creatorByUser = creators
            .OrderByDescending(c => c.CreatedAt)
            .GroupBy(c => c.UserId)
            .ToDictionary(g => g.Key, g => g.First());
        var tiktokByCreator = tiktokAccounts
            .OrderByDescending(t => t.CreatedAt)
            .GroupBy(t => t.CreatorProfileId)
            .ToDictionary(g => g.Key, g => g.First());

        var dtos = users.Select(user =>
        {
            string? companyName = null, orgNumber = null, contactPhone = null;
            string? displayName = null, bio = null, category = null, tiktokUsername = null;
            DateOnly? dateOfBirth = null;
            string? rejectionReason = null;

            if (user.Role == UserRole.Brand && brandByUser.TryGetValue(user.Id, out var brand))
            {
                companyName      = brand.CompanyName;
                orgNumber        = brand.OrganizationNumber;
                contactPhone     = brand.ContactPhone;
                rejectionReason  = brand.RejectionReason;
            }
            else if (user.Role == UserRole.Creator && creatorByUser.TryGetValue(user.Id, out var creator))
            {
                displayName      = creator.DisplayName;
                bio              = creator.Bio;
                category         = creator.Category;
                dateOfBirth      = creator.DateOfBirth;
                rejectionReason  = creator.RejectionReason;

                if (tiktokByCreator.TryGetValue(creator.Id, out var tiktok))
                    tiktokUsername = tiktok.TikTokUsername;
            }

            return new PendingUserDto(
                user.Id, user.Email, user.Role.ToString(), user.Status.ToString(), user.CreatedAt,
                companyName, orgNumber, contactPhone,
                displayName, bio, category, tiktokUsername, dateOfBirth,
                rejectionReason);
        }).ToList();

        return new PagedResult<PendingUserDto>
        {
            Data = dtos,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<Result<PendingUserDto>> ApproveUserAsync(Guid userId, Guid adminId)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return Errors.NotFound("User", userId);

        if (user.Status != UserStatus.PendingVerification)
            return Errors.Validation("User is not pending verification");

        user.Status = UserStatus.Active;

        if (user.Role == UserRole.Brand)
        {
            var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId);
            if (brand != null)
            {
                brand.Status = BrandStatus.Approved;
                brand.ReviewedBy = adminId;
                brand.ReviewedAt = DateTime.UtcNow;
            }
        }
        else if (user.Role == UserRole.Creator)
        {
            var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId);
            if (creator != null)
            {
                creator.Status = CreatorStatus.Approved;
                creator.ReviewedBy = adminId;
                creator.ReviewedAt = DateTime.UtcNow;
            }
        }

        await _uow.SaveChangesAsync();
        await _audit.LogAsync(adminId, "Admin.ApproveUser", "User", userId);

        return (await GetPendingUserDto(user))!;
    }

    public async Task<Result<PendingUserDto>> RejectUserAsync(Guid userId, Guid adminId, string reason)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return Errors.NotFound("User", userId);

        if (user.Status != UserStatus.PendingVerification)
            return Errors.Validation("User is not pending verification");

        user.Status = UserStatus.Deactivated;

        if (user.Role == UserRole.Brand)
        {
            var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId);
            if (brand != null)
            {
                brand.Status = BrandStatus.Rejected;
                brand.ReviewedBy = adminId;
                brand.ReviewedAt = DateTime.UtcNow;
                brand.RejectionReason = reason;
            }
        }
        else if (user.Role == UserRole.Creator)
        {
            var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId);
            if (creator != null)
            {
                creator.Status = CreatorStatus.Rejected;
                creator.ReviewedBy = adminId;
                creator.ReviewedAt = DateTime.UtcNow;
                creator.RejectionReason = reason;
            }
        }

        await _uow.SaveChangesAsync();
        await _audit.LogAsync(adminId, "Admin.RejectUser", "User", userId);

        return (await GetPendingUserDto(user))!;
    }

    private async Task<PendingUserDto> GetPendingUserDto(User user)
    {
        string? companyName = null, orgNumber = null, contactPhone = null;
        string? displayName = null, bio = null, category = null, tiktokUsername = null;
        DateOnly? dateOfBirth = null;
        string? rejectionReason = null;

        if (user.Role == UserRole.Brand)
        {
            var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == user.Id);
            if (brand != null)
            {
                companyName = brand.CompanyName;
                orgNumber = brand.OrganizationNumber;
                contactPhone = brand.ContactPhone;
                rejectionReason = brand.RejectionReason;
            }
        }
        else if (user.Role == UserRole.Creator)
        {
            var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == user.Id);
            if (creator != null)
            {
                displayName = creator.DisplayName;
                bio = creator.Bio;
                category = creator.Category;
                dateOfBirth = creator.DateOfBirth;
                rejectionReason = creator.RejectionReason;

                var tiktok = await _tiktokAccounts.Query()
                    .FirstOrDefaultAsync(t => t.CreatorProfileId == creator.Id);
                tiktokUsername = tiktok?.TikTokUsername;
            }
        }

        return new PendingUserDto(
            user.Id, user.Email, user.Role.ToString(), user.Status.ToString(), user.CreatedAt,
            companyName, orgNumber, contactPhone,
            displayName, bio, category, tiktokUsername, dateOfBirth,
            rejectionReason);
    }
}
