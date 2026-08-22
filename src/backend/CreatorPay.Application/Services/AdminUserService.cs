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
    private readonly IRepository<AdminProfile> _adminProfiles;
    private readonly IEncryptionService _encryption;
    private readonly IRepository<Notification> _notificationRows;
    private readonly IRepository<Review> _reviews;

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
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<AdminProfile> adminProfiles,
        IEncryptionService encryption,
        IRepository<Notification> notificationRows,
        IRepository<Review> reviews)
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
        _adminProfiles = adminProfiles;
        _encryption = encryption;
        _notificationRows = notificationRows;
        _reviews = reviews;
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

    /// <summary>
    /// Creates an additional admin account. Only the SuperAdmin (the
    /// bootstrap-seeded admin) may mint new admins; created admins get the
    /// Moderator level, which has full panel access but cannot add admins.
    /// </summary>
    public async Task<Result<PendingUserDto>> CreateAdminAsync(Guid callerAdminUserId, CreateAdminRequest request)
    {
        var callerProfile = await _adminProfiles.Query()
            .FirstOrDefaultAsync(p => p.UserId == callerAdminUserId);
        if (callerProfile == null || callerProfile.PermissionLevel != AdminLevel.SuperAdmin)
            return Errors.Forbidden("Endast huvudadmin kan lägga till nya admins");

        var email = request.Email.Trim().ToLowerInvariant();
        var exists = await _users.Query().IgnoreQueryFilters().AnyAsync(u => u.Email == email);
        if (exists)
            return Errors.Conflict("Det finns redan ett konto med den här e-postadressen");

        var admin = new User
        {
            Email = email,
            PasswordHash = _encryption.HashPassword(request.Password),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Role = UserRole.Admin,
            Status = UserStatus.Active,
            EmailVerified = true
        };
        _users.Add(admin);

        _adminProfiles.Add(new AdminProfile
        {
            UserId = admin.Id,
            Department = "Platform",
            PermissionLevel = AdminLevel.Moderator
        });

        await _uow.SaveChangesAsync();
        await _audit.LogAsync(callerAdminUserId, "Admin.CreateAdmin", "User", admin.Id);

        await _email.SendAsync(admin.Email, "Du är nu admin på VYRLE",
            EmailTemplates.Branded(
                "Välkommen till admin-teamet",
                $"<p>Hej {System.Net.WebUtility.HtmlEncode(admin.FirstName)}!</p>" +
                "<p>Ett admin-konto har skapats åt dig på VYRLE. Logga in med din " +
                "e-postadress och lösenordet du fått separat — och byt lösenord " +
                "direkt under inställningarna.</p>",
                "Logga in", "https://www.vyrle.co/login"));

        return (await GetPendingUserDto(admin))!;
    }

    /// <summary>
    /// Sends a message to every active user in the chosen audience: an in-app
    /// notification with the subject as title, and optionally a branded email.
    /// Email failures are counted but never abort the broadcast.
    /// </summary>
    public async Task<Result<int>> BroadcastAsync(Guid callerAdminUserId, BroadcastRequest request)
    {
        var query = _users.Query()
            .Where(u => u.Status == UserStatus.Active && u.Role != UserRole.Admin);
        if (request.Audience == "Creators") query = query.Where(u => u.Role == UserRole.Creator);
        else if (request.Audience == "Brands") query = query.Where(u => u.Role == UserRole.Brand);

        var recipients = await query
            .Select(u => new { u.Id, u.Email, u.FirstName })
            .ToListAsync();

        var subject = request.Subject.Trim();
        var message = request.Message.Trim();

        foreach (var r in recipients)
            _notificationRows.Add(new Notification
            {
                UserId = r.Id,
                Type = NotificationType.SystemMessage,
                Title = subject,
                Message = message
            });
        await _uow.SaveChangesAsync();

        if (request.SendEmail)
        {
            foreach (var r in recipients)
            {
                try
                {
                    await _email.SendAsync(r.Email, subject,
                        EmailTemplates.Branded(subject,
                            $"<p>Hej {System.Net.WebUtility.HtmlEncode(r.FirstName)}!</p>" +
                            $"<p>{System.Net.WebUtility.HtmlEncode(message).Replace("\n", "<br/>")}</p>",
                            "Öppna VYRLE", "https://www.vyrle.co/login"));
                }
                catch
                {
                    // best-effort per recipient; the in-app notification already landed
                }
            }
        }

        await _audit.LogAsync(callerAdminUserId, "Admin.Broadcast", "User", null);
        return recipients.Count;
    }

    public async Task<Result<AdminCreatorFullDto>> GetCreatorFullProfileAsync(Guid userId)
    {
        var user = await _users.Query().IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Errors.NotFound("User", userId);

        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .Include(c => c.PortfolioItems)
            .FirstOrDefaultAsync(c => c.UserId == userId);
        if (creator == null) return Errors.NotFound("CreatorProfile", userId);

        var assignmentStats = await _assignments.Query()
            .Where(a => a.CreatorProfileId == creator.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Active = g.Count(a => a.Status == AssignmentStatus.Active),
                Completed = g.Count(a => a.Status == AssignmentStatus.Completed),
                Views = g.Sum(a => (long?)a.TotalVerifiedViews) ?? 0,
                Earned = g.Sum(a => (decimal?)a.CurrentPayoutAmount) ?? 0
            })
            .FirstOrDefaultAsync();

        var paidOut = await _payouts.Query()
            .Where(p => p.CreatorProfileId == creator.Id && p.Status == PayoutStatus.Completed)
            .SumAsync(p => (decimal?)p.RequestedAmount) ?? 0m;

        var reviewAgg = await _reviews.Query()
            .Where(r => r.RevieweeId == userId)
            .GroupBy(_ => 1)
            .Select(g => new { Avg = g.Average(r => (double)r.Stars), Count = g.Count() })
            .FirstOrDefaultAsync();

        var tt = creator.TikTokAccount;
        return new AdminCreatorFullDto(
            user.Id, user.Email, user.EmailVerified, user.Status.ToString(), user.AuthProvider,
            user.CreatedAt, user.LastLoginAt,
            creator.Id, creator.DisplayName, creator.Bio, creator.Category, creator.Country, creator.Language,
            creator.AvatarUrl, creator.Website, creator.DateOfBirth, creator.ProfileTags?.ToList() ?? [],
            creator.FollowerCount, creator.AverageViews, creator.InstagramUsername, creator.InstagramFollowerCount,
            creator.Status.ToString(),
            tt?.TikTokUsername, tt is { IsActive: true }, tt != null && tt.Scopes != "manual", tt?.FollowerCount ?? 0, tt?.LastSyncAt,
            assignmentStats?.Active ?? 0, assignmentStats?.Completed ?? 0, assignmentStats?.Views ?? 0,
            assignmentStats?.Earned ?? 0m, paidOut,
            !string.IsNullOrEmpty(creator.PayoutMethod), creator.PayoutMethod,
            Math.Round(reviewAgg?.Avg ?? 0, 1), reviewAgg?.Count ?? 0, creator.PortfolioItems?.Count ?? 0);
    }

    /// <summary>
    /// Soft-deletes an account: it disappears from every listing, cannot log
    /// in, and its refresh tokens are revoked — while campaign and payout
    /// history stays intact for auditing. Admin accounts and the caller's
    /// own account are protected.
    /// </summary>
    public async Task<Result<bool>> DeleteUserAsync(Guid callerAdminUserId, Guid userId)
    {
        if (callerAdminUserId == userId)
            return Errors.Validation("Du kan inte radera ditt eget konto");

        var user = await _users.Query().IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return Errors.NotFound("User", userId);
        if (user.Role == UserRole.Admin)
            return Errors.Forbidden("Admin-konton kan inte raderas härifrån");

        user.IsDeleted = true;
        user.Status = UserStatus.Deactivated;
        user.RefreshTokenHash = null;
        await _uow.SaveChangesAsync();
        await _audit.LogAsync(callerAdminUserId, "Admin.DeleteUser", "User", userId);
        return true;
    }
}
