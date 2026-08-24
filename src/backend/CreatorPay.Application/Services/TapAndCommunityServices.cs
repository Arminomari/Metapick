using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Application.PayoutEngine;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

// ────────────────────────────────────────────────────────────────
// CommunityService – a brand's creator community = the right to draw
// from the tap. Previous collaborators qualify automatically; brands
// invite and remove; members are auto-assigned to the brand's tap.
// ────────────────────────────────────────────────────────────────
public class CommunityService : ICommunityService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<BrandCommunityMember> _members;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<Campaign> _campaigns;
    private readonly IRepository<CampaignApplication> _applications;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<TrackingTag> _tags;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;

    public CommunityService(
        IUnitOfWork uow,
        IRepository<BrandCommunityMember> members,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        IRepository<Campaign> campaigns,
        IRepository<CampaignApplication> applications,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<TrackingTag> tags,
        INotificationService notifications,
        IAuditService audit)
    {
        _uow = uow;
        _members = members;
        _brands = brands;
        _creators = creators;
        _campaigns = campaigns;
        _applications = applications;
        _assignments = assignments;
        _tags = tags;
        _notifications = notifications;
        _audit = audit;
    }

    public async Task<Result<List<CommunityMemberDto>>> GetMembersAsync(Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var rows = await _members.Query()
            .Include(m => m.CreatorProfile).ThenInclude(c => c.TikTokAccount)
            .Where(m => m.BrandProfileId == brand.Id && m.Status != CommunityMemberStatus.Removed)
            .OrderByDescending(m => m.JoinedAt)
            .ToListAsync(ct);

        var creatorIds = rows.Select(r => r.CreatorProfileId).ToList();
        var earned = await _assignments.Query()
            .Where(a => creatorIds.Contains(a.CreatorProfileId) && a.Campaign.BrandProfileId == brand.Id)
            .GroupBy(a => a.CreatorProfileId)
            .Select(g => new { CreatorId = g.Key, Earned = g.Sum(a => a.CurrentPayoutAmount), Views = g.Sum(a => a.TotalVerifiedViews), Jobs = g.Count() })
            .ToListAsync(ct);
        var byCreator = earned.ToDictionary(e => e.CreatorId);

        return rows.Select(r =>
        {
            byCreator.TryGetValue(r.CreatorProfileId, out var e);
            return new CommunityMemberDto(
                r.CreatorProfileId, r.CreatorProfile.DisplayName, r.CreatorProfile.AvatarUrl,
                r.CreatorProfile.TikTokAccount?.TikTokUsername, r.CreatorProfile.TikTokAccount?.FollowerCount ?? 0,
                r.Status.ToString(), r.Source.ToString(), r.JoinedAt,
                e?.Earned ?? 0, e?.Views ?? 0, e?.Jobs ?? 0);
        }).ToList();
    }

    public async Task<Result<CommunityMemberDto>> InviteAsync(Guid brandUserId, Guid creatorProfileId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        var creator = await _creators.Query().Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.Id == creatorProfileId && c.Status == CreatorStatus.Approved, ct);
        if (creator == null) return Errors.NotFound("Creator", creatorProfileId);

        var member = await EnsureMemberAsync(brand.Id, creator.Id, CommunityMemberSource.Invited, ct);
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(brandUserId, "Community.Invited", "CreatorProfile", creator.Id);
        await _notifications.SendAsync(creator.UserId, NotificationType.SystemMessage,
            $"{brand.CompanyName} har bjudit in dig till sitt creator-community. Du kan nu hämta ur deras kran — kolla Mina kampanjer.");

        return new CommunityMemberDto(creator.Id, creator.DisplayName, creator.AvatarUrl,
            creator.TikTokAccount?.TikTokUsername, creator.TikTokAccount?.FollowerCount ?? 0,
            member.Status.ToString(), member.Source.ToString(), member.JoinedAt, 0, 0, 0);
    }

    /// <summary>Invites many creators in one go — the bulk path from the community page.</summary>
    public async Task<Result<int>> InviteManyAsync(Guid brandUserId, List<Guid> creatorProfileIds, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        if (creatorProfileIds == null || creatorProfileIds.Count == 0) return 0;

        var creators = await _creators.Query()
            .Where(c => creatorProfileIds.Contains(c.Id) && c.Status == CreatorStatus.Approved)
            .ToListAsync(ct);

        var invited = 0;
        foreach (var creator in creators)
        {
            await EnsureMemberAsync(brand.Id, creator.Id, CommunityMemberSource.Invited, ct);
            invited++;
        }
        await _uow.SaveChangesAsync(ct);

        foreach (var creator in creators)
        {
            try
            {
                await _notifications.SendAsync(creator.UserId, NotificationType.SystemMessage,
                    $"{brand.CompanyName} har bjudit in dig till sitt creator-community. Du kan nu hämta ur deras kran — kolla Mina kampanjer.");
            }
            catch { /* one failure must not stop the batch */ }
        }
        await _audit.LogAsync(brandUserId, "Community.InvitedMany", "BrandProfile", brand.Id);
        return invited;
    }

    /// <summary>
    /// A creator knocks on the door: membership is requested, never taken. The
    /// brand decides — community access is the right to draw from their tap.
    /// </summary>
    public async Task<Result<bool>> RequestMembershipAsync(Guid creatorUserId, Guid brandProfileId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        if (creator.Status != CreatorStatus.Approved)
            return Errors.Forbidden("Ditt konto måste vara godkänt först.");

        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.Id == brandProfileId, ct);
        if (brand == null) return Errors.NotFound("Brand", brandProfileId);

        var member = await _members.Query()
            .FirstOrDefaultAsync(m => m.BrandProfileId == brandProfileId && m.CreatorProfileId == creator.Id, ct);
        if (member is { Status: CommunityMemberStatus.Active }) return true;

        if (member == null)
        {
            member = new BrandCommunityMember
            {
                BrandProfileId = brandProfileId,
                CreatorProfileId = creator.Id,
                Source = CommunityMemberSource.Joined,
                Status = CommunityMemberStatus.Requested,
                JoinedAt = DateTime.UtcNow
            };
            _members.Add(member);
        }
        else
        {
            member.Status = CommunityMemberStatus.Requested;
            member.JoinedAt = DateTime.UtcNow;
        }
        await _uow.SaveChangesAsync(ct);

        try
        {
            await _notifications.SendAsync(brand.UserId, NotificationType.NewApplication,
                $"{creator.DisplayName} vill gå med i ert creator-community.");
        }
        catch { /* request is stored either way */ }
        return true;
    }

    public async Task<Result<bool>> RespondToRequestAsync(Guid brandUserId, Guid creatorProfileId, bool approve, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var member = await _members.Query()
            .Include(m => m.CreatorProfile)
            .FirstOrDefaultAsync(m => m.BrandProfileId == brand.Id && m.CreatorProfileId == creatorProfileId, ct);
        if (member == null) return Errors.NotFound("Member", creatorProfileId);

        if (approve)
        {
            await EnsureMemberAsync(brand.Id, creatorProfileId, member.Source, ct);
            await _uow.SaveChangesAsync(ct);
            await _audit.LogAsync(brandUserId, "Community.RequestApproved", "CreatorProfile", creatorProfileId);
            try
            {
                await _notifications.SendAsync(member.CreatorProfile.UserId, NotificationType.SystemMessage,
                    $"{brand.CompanyName} har godkänt dig i sitt creator-community — du kan nu hämta ur deras kran.");
            }
            catch { }
        }
        else
        {
            member.Status = CommunityMemberStatus.Removed;
            await _uow.SaveChangesAsync(ct);
            await _audit.LogAsync(brandUserId, "Community.RequestRejected", "CreatorProfile", creatorProfileId);
        }
        return true;
    }

    public async Task<Result<bool>> RemoveAsync(Guid brandUserId, Guid creatorProfileId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var member = await _members.Query()
            .FirstOrDefaultAsync(m => m.BrandProfileId == brand.Id && m.CreatorProfileId == creatorProfileId, ct);
        if (member == null) return Errors.NotFound("Member", creatorProfileId);

        member.Status = CommunityMemberStatus.Removed;

        // Membership is the right to draw: pause their tap assignments.
        var tapAssignments = await _assignments.Query()
            .Include(a => a.Campaign)
            .Where(a => a.CreatorProfileId == creatorProfileId && a.Campaign.BrandProfileId == brand.Id
                && a.Campaign.Kind == CampaignKind.Tap && a.Status == AssignmentStatus.Active)
            .ToListAsync(ct);
        foreach (var a in tapAssignments) a.Status = AssignmentStatus.Paused;

        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(brandUserId, "Community.Removed", "CreatorProfile", creatorProfileId);
        return true;
    }

    public async Task<Result<bool>> LeaveAsync(Guid creatorUserId, Guid brandProfileId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var member = await _members.Query()
            .FirstOrDefaultAsync(m => m.BrandProfileId == brandProfileId && m.CreatorProfileId == creator.Id, ct);
        if (member == null) return true;
        member.Status = CommunityMemberStatus.Left;
        var tapAssignments = await _assignments.Query()
            .Include(a => a.Campaign)
            .Where(a => a.CreatorProfileId == creator.Id && a.Campaign.BrandProfileId == brandProfileId
                && a.Campaign.Kind == CampaignKind.Tap && a.Status == AssignmentStatus.Active)
            .ToListAsync(ct);
        foreach (var a in tapAssignments) a.Status = AssignmentStatus.Paused;
        await _uow.SaveChangesAsync(ct);
        return true;
    }

    public async Task<Result<List<MyCommunityDto>>> GetMyCommunitiesAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return new List<MyCommunityDto>();

        var rows = await _members.Query()
            .Include(m => m.BrandProfile)
            .Where(m => m.CreatorProfileId == creator.Id && m.Status == CommunityMemberStatus.Active)
            .OrderByDescending(m => m.JoinedAt)
            .ToListAsync(ct);
        var brandIds = rows.Select(r => r.BrandProfileId).ToList();
        var tapsByBrand = await _campaigns.Query()
            .Where(c => brandIds.Contains(c.BrandProfileId) && c.Kind == CampaignKind.Tap && c.Status == CampaignStatus.Active && !c.IsDeleted)
            .Select(c => c.BrandProfileId)
            .ToListAsync(ct);
        var hasTap = tapsByBrand.ToHashSet();

        return rows.Select(r => new MyCommunityDto(
            r.BrandProfileId, r.BrandProfile.CompanyName, r.BrandProfile.LogoUrl,
            r.Source.ToString(), r.JoinedAt, hasTap.Contains(r.BrandProfileId))).ToList();
    }

    /// <summary>
    /// Idempotent: creates or re-activates membership and makes sure the
    /// creator has an active assignment (with tracking tag) on the brand's
    /// active tap. Caller saves.
    /// </summary>
    public async Task<BrandCommunityMember> EnsureMemberAsync(Guid brandProfileId, Guid creatorProfileId, CommunityMemberSource source, CancellationToken ct = default)
    {
        var member = await _members.Query()
            .FirstOrDefaultAsync(m => m.BrandProfileId == brandProfileId && m.CreatorProfileId == creatorProfileId, ct);
        if (member == null)
        {
            member = new BrandCommunityMember
            {
                BrandProfileId = brandProfileId,
                CreatorProfileId = creatorProfileId,
                Source = source,
                Status = CommunityMemberStatus.Active,
                JoinedAt = DateTime.UtcNow
            };
            _members.Add(member);
        }
        else if (member.Status != CommunityMemberStatus.Active)
        {
            member.Status = CommunityMemberStatus.Active;
            member.JoinedAt = DateTime.UtcNow;
        }

        await EnsureTapAssignmentsAsync(brandProfileId, creatorProfileId, ct);
        return member;
    }

    /// <summary>Gives every active tap of the brand an assignment for this creator.</summary>
    public async Task EnsureTapAssignmentsAsync(Guid brandProfileId, Guid creatorProfileId, CancellationToken ct = default)
    {
        var taps = await _campaigns.Query()
            .Where(c => c.BrandProfileId == brandProfileId && c.Kind == CampaignKind.Tap
                && c.Status == CampaignStatus.Active && !c.IsDeleted)
            .ToListAsync(ct);
        if (taps.Count == 0) return;

        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.Id == creatorProfileId, ct);
        if (creator == null) return;

        foreach (var tap in taps)
        {
            var existing = await _assignments.Query()
                .FirstOrDefaultAsync(a => a.CampaignId == tap.Id && a.CreatorProfileId == creatorProfileId, ct);
            if (existing != null)
            {
                if (existing.Status == AssignmentStatus.Paused) existing.Status = AssignmentStatus.Active;
                continue;
            }

            // Taps have no application step — membership IS the approval. Keep the
            // invariant that every assignment has an (approved) application row.
            var app = new CampaignApplication
            {
                CampaignId = tap.Id,
                CreatorProfileId = creatorProfileId,
                Message = "Community-medlem",
                Status = ApplicationStatus.Approved,
                ReviewedAt = DateTime.UtcNow
            };
            _applications.Add(app);

            var assignment = new CreatorCampaignAssignment
            {
                CampaignId = tap.Id,
                CreatorProfileId = creatorProfileId,
                ApplicationId = app.Id,
                Status = AssignmentStatus.Active,
                AssignedAt = DateTime.UtcNow
            };
            _assignments.Add(assignment);

            var tagCode = $"CP{tap.Id.ToString("N")[..8]}{creator.Id.ToString("N")[..6]}{Guid.NewGuid().ToString("N")[..4]}".ToUpperInvariant();
            _tags.Add(new TrackingTag
            {
                AssignmentId = assignment.Id,
                TagCode = tagCode,
                RecommendedHashtag = tap.RequiredHashtag,
                IsActive = true
            });
        }
    }
}

// ────────────────────────────────────────────────────────────────
// TapService – one standing tap per brand: create/update, month view,
// creator view of the taps they can draw from.
// ────────────────────────────────────────────────────────────────
public class TapService : ITapService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<Campaign> _campaigns;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<BrandCommunityMember> _members;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<TapAccrual> _accruals;
    private readonly IRepository<CreatorSubmission> _submissions;
    private readonly TapAccrualService _tapAccrual;
    private readonly ICommunityService _community;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;

    public TapService(
        IUnitOfWork uow,
        IRepository<Campaign> campaigns,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        IRepository<BrandCommunityMember> members,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<TapAccrual> accruals,
        IRepository<CreatorSubmission> submissions,
        TapAccrualService tapAccrual,
        ICommunityService community,
        INotificationService notifications,
        IAuditService audit)
    {
        _uow = uow;
        _campaigns = campaigns;
        _brands = brands;
        _creators = creators;
        _members = members;
        _assignments = assignments;
        _accruals = accruals;
        _submissions = submissions;
        _tapAccrual = tapAccrual;
        _community = community;
        _notifications = notifications;
        _audit = audit;
    }

    private async Task<Campaign?> FindTapAsync(Guid brandProfileId, CancellationToken ct) =>
        await _campaigns.Query()
            .Include(c => c.PayoutRules)
            .FirstOrDefaultAsync(c => c.BrandProfileId == brandProfileId && c.Kind == CampaignKind.Tap && !c.IsDeleted, ct);

    public async Task<Result<TapDto?>> GetBrandTapAsync(Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        var tap = await FindTapAsync(brand.Id, ct);
        if (tap == null) return (TapDto?)null;
        return await MapAsync(tap, brand.Id, ct);
    }

    public async Task<Result<TapDto>> UpsertTapAsync(Guid brandUserId, UpsertTapRequest request, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        if (brand.Status != BrandStatus.Approved)
            return Errors.Forbidden("Kontot måste vara godkänt innan kranen kan öppnas");

        var tap = await FindTapAsync(brand.Id, ct);
        var isNew = tap == null;
        if (tap == null)
        {
            tap = new Campaign
            {
                BrandProfileId = brand.Id,
                Kind = CampaignKind.Tap,
                Country = brand.Country,
                Category = request.Category?.Trim() is { Length: > 0 } cat ? cat : "Övrigt",
                PayoutModel = PayoutModel.CPM,
                MaxCreators = 100_000,
                RequiredVideoCount = 1,
                MinViews = 0,
                StartDate = DateTime.UtcNow.Date,
                EndDate = DateTime.UtcNow.Date.AddYears(10),
                Status = CampaignStatus.Active,
                ModerationStatus = ModerationStatus.Approved,
                PublishedAt = DateTime.UtcNow,
                Name = request.Name.Trim(),
                Description = request.Brief.Trim(),
                RequiredHashtag = request.RequiredHashtag.Trim().TrimStart('#')
            };
            _campaigns.Add(tap);
        }

        tap.Name = request.Name.Trim();
        tap.Description = request.Brief.Trim();
        tap.ContentInstructions = string.IsNullOrWhiteSpace(request.ContentInstructions) ? null : request.ContentInstructions.Trim();
        tap.RequiredHashtag = request.RequiredHashtag.Trim().TrimStart('#');
        tap.MonthlyBudget = request.MonthlyBudget;
        tap.Budget = request.MonthlyBudget;
        tap.PayoutCapPerVideo = request.PayoutCapPerVideo is > 0 ? request.PayoutCapPerVideo : null;
        tap.MonthlyCapPerCreator = request.MonthlyCapPerCreator is > 0 ? request.MonthlyCapPerCreator : null;
        tap.BriefUpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Category)) tap.Category = request.Category.Trim();

        // Single fixed CPM rule (floor enforced by validator).
        var cpmRule = tap.PayoutRules.FirstOrDefault(r => r.PayoutType == PayoutType.CPM);
        if (cpmRule == null)
        {
            tap.PayoutRules.Add(new PayoutRule
            {
                CampaignId = tap.Id,
                PayoutType = PayoutType.CPM,
                TriggerType = PayoutTriggerType.Views,
                MinViews = 0,
                Amount = request.Cpm,
                Currency = "SEK",
                MaxPayoutPerCreator = request.MonthlyCapPerCreator,
                SortOrder = 0
            });
        }
        else
        {
            cpmRule.Amount = request.Cpm;
            cpmRule.MaxPayoutPerCreator = request.MonthlyCapPerCreator;
        }

        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(brandUserId, isNew ? "Tap.Opened" : "Tap.Updated", "Campaign", tap.Id);

        // Everyone already in the community gets their assignment now.
        var memberIds = await _members.Query()
            .Where(m => m.BrandProfileId == brand.Id && m.Status == CommunityMemberStatus.Active)
            .Select(m => m.CreatorProfileId)
            .ToListAsync(ct);
        foreach (var cid in memberIds)
            await _community.EnsureTapAssignmentsAsync(brand.Id, cid, ct);
        await _uow.SaveChangesAsync(ct);

        if (isNew)
        {
            var memberUserIds = await _members.Query()
                .Where(m => m.BrandProfileId == brand.Id && m.Status == CommunityMemberStatus.Active)
                .Join(_creators.Query(), m => m.CreatorProfileId, c => c.Id, (m, c) => c.UserId)
                .ToListAsync(ct);
            foreach (var uid in memberUserIds)
            {
                try
                {
                    await _notifications.SendAsync(uid, NotificationType.SystemMessage,
                        $"{brand.CompanyName} har öppnat sin kran: {request.Cpm:0} kr per 1 000 views, löpande varje månad. Publicera med din tracking-tag så räknas det.");
                }
                catch { /* fan-out is best-effort */ }
            }
        }

        return await MapAsync(tap, brand.Id, ct);
    }

    public async Task<Result<TapDto>> SetTapStatusAsync(Guid brandUserId, bool active, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        var tap = await FindTapAsync(brand.Id, ct);
        if (tap == null) return Errors.NotFound("Tap");
        tap.Status = active ? CampaignStatus.Active : CampaignStatus.Paused;
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(brandUserId, active ? "Tap.Resumed" : "Tap.Paused", "Campaign", tap.Id);
        return await MapAsync(tap, brand.Id, ct);
    }

    private async Task<TapDto> MapAsync(Campaign tap, Guid brandProfileId, CancellationToken ct)
    {
        var s = await _tapAccrual.SummarizeAsync(tap, ct);
        var memberCount = await _members.Query()
            .CountAsync(m => m.BrandProfileId == brandProfileId && m.Status == CommunityMemberStatus.Active, ct);
        return new TapDto(
            tap.Id, tap.Name, tap.Status.ToString(), tap.MonthlyBudget, TapAccrualService.CpmOf(tap),
            tap.PayoutCapPerVideo, tap.MonthlyCapPerCreator,
            tap.Description, tap.ContentInstructions, tap.RequiredHashtag, tap.Category,
            s.Spent, s.Remaining, s.Views, s.ActiveCreators, memberCount, tap.BriefUpdatedAt, tap.CreatedAt);
    }

    /// <summary>
    /// Videos from the tap waiting for the brand — the tap never appears in the
    /// campaigns list, so this is the only place these can be reviewed.
    /// </summary>
    public async Task<Result<List<TapSubmissionDto>>> GetTapSubmissionsAsync(Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");
        var tap = await FindTapAsync(brand.Id, ct);
        if (tap == null) return new List<TapSubmissionDto>();

        var pending = await _submissions.Query()
            .Include(s => s.Assignment).ThenInclude(a => a.CreatorProfile)
            .Include(s => s.SocialPost)
            .Where(s => s.Assignment.CampaignId == tap.Id && s.Status == SubmissionStatus.Pending)
            .OrderBy(s => s.CreatedAt)
            .ToListAsync(ct);

        return pending.Select(s => new TapSubmissionDto(
            s.Id, s.AssignmentId,
            s.Assignment.CreatorProfile.DisplayName, s.Assignment.CreatorProfile.AvatarUrl,
            s.Assignment.CreatorProfileId,
            s.TikTokVideoUrl, s.TikTokVideoId,
            s.SocialPost?.LatestViewCount ?? 0,
            s.CreatedAt,
            Math.Max(0, 48 - (int)(DateTime.UtcNow - s.CreatedAt).TotalHours))).ToList();
    }

    public async Task<Result<List<CreatorTapDto>>> GetCreatorTapsAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return new List<CreatorTapDto>();

        var assignments = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.PayoutRules)
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Where(a => a.CreatorProfileId == creator.Id && a.Campaign.Kind == CampaignKind.Tap && !a.Campaign.IsDeleted
                && (a.Status == AssignmentStatus.Active || a.Status == AssignmentStatus.Paused))
            .ToListAsync(ct);
        if (assignments.Count == 0) return new List<CreatorTapDto>();

        var now = DateTime.UtcNow;
        var ids = assignments.Select(a => a.Id).ToList();
        var mine = await _accruals.Query()
            .Where(x => ids.Contains(x.AssignmentId) && x.Year == now.Year && x.Month == now.Month)
            .ToListAsync(ct);

        var result = new List<CreatorTapDto>();
        foreach (var a in assignments)
        {
            var tap = a.Campaign;
            var s = await _tapAccrual.SummarizeAsync(tap, ct);
            var my = mine.FirstOrDefault(x => x.AssignmentId == a.Id);
            result.Add(new CreatorTapDto(
                tap.Id, a.Id, tap.BrandProfileId, tap.BrandProfile.CompanyName, tap.BrandProfile.LogoUrl,
                tap.Name, tap.Status.ToString(), a.Status.ToString(),
                tap.Description, tap.ContentInstructions, tap.RequiredHashtag,
                TapAccrualService.CpmOf(tap), tap.PayoutCapPerVideo, tap.MonthlyCapPerCreator,
                my?.Amount ?? 0, my?.Views ?? 0, a.CurrentPayoutAmount,
                s.Budget, s.Spent, tap.BriefUpdatedAt));
        }
        return result;
    }
}
