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
    private readonly INotificationService _notify;
    private readonly IEmailService _email;
    private readonly IRepository<Campaign> _campaigns;
    private readonly IRepository<PayoutRequest> _payouts;
    private readonly IRepository<FraudFlag> _fraudFlags;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;

    public AdminUserService(
        IRepository<User> users,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        IRepository<TikTokAccount> tiktokAccounts,
        IUnitOfWork uow,
        IAuditService audit,
        INotificationService notify,
        IEmailService email,
        IRepository<Campaign> campaigns,
        IRepository<PayoutRequest> payouts,
        IRepository<FraudFlag> fraudFlags,
        IRepository<CreatorCampaignAssignment> assignments)
    {
        _users = users;
        _brands = brands;
        _creators = creators;
        _tiktokAccounts = tiktokAccounts;
        _uow = uow;
        _audit = audit;
        _notify = notify;
        _email = email;
        _campaigns = campaigns;
        _payouts = payouts;
        _fraudFlags = fraudFlags;
        _assignments = assignments;
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
            string? avatarUrl = null, instagramUsername = null, website = null, industry = null;
            int? followerCount = null;

            if (user.Role == UserRole.Brand && brandByUser.TryGetValue(user.Id, out var brand))
            {
                companyName      = brand.CompanyName;
                orgNumber        = brand.OrganizationNumber;
                contactPhone     = brand.ContactPhone;
                rejectionReason  = brand.RejectionReason;
                avatarUrl        = brand.LogoUrl;
                website          = brand.Website;
                industry         = brand.Industry;
            }
            else if (user.Role == UserRole.Creator && creatorByUser.TryGetValue(user.Id, out var creator))
            {
                displayName      = creator.DisplayName;
                bio              = creator.Bio;
                category         = creator.Category;
                dateOfBirth      = creator.DateOfBirth;
                rejectionReason  = creator.RejectionReason;
                avatarUrl        = creator.AvatarUrl;
                followerCount    = creator.FollowerCount;
                instagramUsername = creator.InstagramUsername;
                website          = creator.Website;

                if (tiktokByCreator.TryGetValue(creator.Id, out var tiktok))
                    tiktokUsername = tiktok.TikTokUsername;
            }

            return new PendingUserDto(
                user.Id, user.Email, user.Role.ToString(), user.Status.ToString(), user.CreatedAt,
                companyName, orgNumber, contactPhone,
                displayName, bio, category, tiktokUsername, dateOfBirth,
                rejectionReason,
                user.AuthProvider, avatarUrl, followerCount, instagramUsername, website, industry);
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

        var approvedType = user.Role == UserRole.Brand
            ? NotificationType.BrandApproved
            : NotificationType.CreatorApproved;
        await _notify.SendAsync(user.Id, approvedType,
            "Ditt konto är godkänt — välkommen till VYRLE! 🎉", user.Id);
        await _email.SendAsync(user.Email, "Ditt VYRLE-konto är godkänt 🎉",
            EmailTemplates.Branded(
                "Välkommen till VYRLE!",
                $"<p>Hej {System.Net.WebUtility.HtmlEncode(user.FirstName)}!</p>" +
                "<p>Ditt konto är nu godkänt och du kan logga in och komma igång direkt.</p>",
                "Logga in", "https://www.vyrle.co/login"));

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

        await _notify.SendAsync(user.Id, NotificationType.SystemMessage,
            $"Din ansökan godkändes tyvärr inte: {reason}", user.Id);
        await _email.SendAsync(user.Email, "Angående din VYRLE-ansökan",
            EmailTemplates.Branded(
                "Angående din ansökan",
                $"<p>Hej {System.Net.WebUtility.HtmlEncode(user.FirstName)},</p>" +
                "<p>Tyvärr kunde vi inte godkänna ditt konto den här gången.</p>" +
                $"<p><b>Motivering:</b> {System.Net.WebUtility.HtmlEncode(reason)}</p>" +
                "<p>Hör gärna av dig om du tror att det är ett misstag.</p>"));

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

    public async Task<Result<AdminStatsDto>> GetStatsAsync()
    {
        var totalUsers = await _users.Query().CountAsync(u => u.Role != UserRole.Admin);
        var pendingUsers = await _users.Query().CountAsync(u => u.Role != UserRole.Admin && u.Status == UserStatus.PendingVerification);
        var creators = await _creators.Query().CountAsync();
        var brands = await _brands.Query().CountAsync();
        var activeCampaigns = await _campaigns.Query().CountAsync(c => c.Status == CampaignStatus.Active);
        var pendingCampaigns = await _campaigns.Query().CountAsync(c => c.Status == CampaignStatus.PendingReview);
        var pendingPayouts = await _payouts.Query().CountAsync(p => p.Status == PayoutStatus.Pending || p.Status == PayoutStatus.UnderReview);
        var pendingPayoutAmount = await _payouts.Query()
            .Where(p => p.Status == PayoutStatus.Pending || p.Status == PayoutStatus.UnderReview)
            .SumAsync(p => (decimal?)p.RequestedAmount) ?? 0m;
        var totalPaidOut = await _payouts.Query()
            .Where(p => p.Status == PayoutStatus.Completed)
            .SumAsync(p => (decimal?)p.RequestedAmount) ?? 0m;
        var totalViews = await _assignments.Query().SumAsync(a => (long?)a.TotalVerifiedViews) ?? 0L;
        var openFraud = await _fraudFlags.Query().CountAsync(f => f.Status == FraudStatus.Open || f.Status == FraudStatus.UnderReview);

        return new AdminStatsDto(
            totalUsers, pendingUsers, creators, brands,
            activeCampaigns, pendingCampaigns,
            pendingPayouts, pendingPayoutAmount, totalPaidOut,
            totalViews, openFraud);
    }
}
