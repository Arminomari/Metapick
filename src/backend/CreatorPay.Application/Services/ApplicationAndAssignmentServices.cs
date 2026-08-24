using System.Text.RegularExpressions;
using CreatorPay.Application.PayoutEngine;
using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Services;

// ────────────────────────────────────────────────────────────────
// ApplicationService – hanterar ansökningar till kampanjer
// ────────────────────────────────────────────────────────────────
public class ApplicationService : IApplicationService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<CampaignApplication> _applications;
    private readonly IRepository<Campaign> _campaigns;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<TrackingTag> _tags;
    private readonly IAuditService _audit;
    private readonly INotificationService _notifications;
    private readonly ILogger<ApplicationService> _logger;
    private readonly IRepository<User> _userAccounts;
    private readonly ICommunityService _community;

    public ApplicationService(
        IUnitOfWork uow,
        IRepository<CampaignApplication> applications,
        IRepository<Campaign> campaigns,
        IRepository<CreatorProfile> creators,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<TrackingTag> tags,
        IAuditService audit,
        INotificationService notifications,
        ILogger<ApplicationService> logger,
        IRepository<User> userAccounts,
        ICommunityService community)
    {
        _uow = uow;
        _applications = applications;
        _campaigns = campaigns;
        _creators = creators;
        _assignments = assignments;
        _tags = tags;
        _audit = audit;
        _notifications = notifications;
        _logger = logger;
        _userAccounts = userAccounts;
        _community = community;
    }

    public async Task<Result<ApplicationDto>> ApplyToCampaignAsync(Guid creatorUserId, ApplyToCampaignRequest request, CancellationToken ct = default)
    {
        // Pre-flight reads — no locking needed
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.Forbidden("Creator profile not found");
        if (creator.Status != CreatorStatus.Approved)
            return Errors.Forbidden("Ditt konto är inte godkänt för kampanjer ännu.");

        // Fake addresses stop here: campaign work requires a proven inbox.
        var applicantEmailVerified = await _userAccounts.Query()
            .Where(u => u.Id == creatorUserId)
            .Select(u => u.EmailVerified)
            .FirstOrDefaultAsync(ct);
        if (!applicantEmailVerified)
            return Errors.Forbidden("Bekräfta din e-postadress först — kolla mejlet vi skickat, eller begär en ny länk i bannern högst upp.");

        // Applying requires a REAL TikTok login (OAuth) — a typed-in username
        // proves nothing and is exactly how fake accounts would slip in.
        if (creator.TikTokAccount is not { IsActive: true } || creator.TikTokAccount.Scopes == "manual")
            return Errors.Forbidden("Logga in med TikTok först — koppla ditt konto via TikTok-knappen på Upptäck-sidan innan du ansöker.");

        var campaign = await _campaigns.Query()
            .Include(c => c.BrandProfile)
            .FirstOrDefaultAsync(c => c.Id == request.CampaignId, ct);
        if (campaign == null) return Errors.NotFound("Campaign", request.CampaignId);
        if (campaign.Kind == CampaignKind.Tap)
            return Errors.Forbidden("Kranen söker man inte till — gå till företagets profil och ansök om att gå med i deras community.");
        if (campaign.Status != CampaignStatus.Active)
            return Errors.Conflict("Kampanjen tar inte emot ansökningar just nu.");

        // ── Serializable transaction prevents TOCTOU race ────────────────────
        // Without this, two concurrent requests can both pass the duplicate/max-creator
        // checks and both create an assignment, silently exceeding MaxCreators.
        CampaignApplication app;
        await _uow.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        try
        {
            var existing = await _applications.Query()
                .AnyAsync(a => a.CampaignId == request.CampaignId && a.CreatorProfileId == creator.Id
                    && a.Status != ApplicationStatus.Rejected && a.Status != ApplicationStatus.Withdrawn, ct);
            if (existing)
            {
                await _uow.RollbackTransactionAsync(ct);
                return Errors.AlreadyApplied;
            }

            var activeAssignments = await _assignments.Query()
                .CountAsync(a => a.CampaignId == request.CampaignId && a.Status == AssignmentStatus.Active, ct);
            if (activeAssignments >= campaign.MaxCreators)
            {
                await _uow.RollbackTransactionAsync(ct);
                return Errors.CampaignFull;
            }

            app = new CampaignApplication
            {
                CampaignId = request.CampaignId,
                CreatorProfileId = creator.Id,
                Message = request.Message,
                Status = ApplicationStatus.Pending
            };

            if (campaign.ReviewMode == ReviewMode.AutoApprove)
            {
                app.Status = ApplicationStatus.Approved;
                app.ReviewedAt = DateTime.UtcNow;
                await CreateAssignment(campaign, creator, app);
            }

            _applications.Add(app);
            await _uow.SaveChangesAsync(ct);
            await _uow.CommitTransactionAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            await _uow.RollbackTransactionAsync(ct);
            return Errors.AlreadyApplied;
        }
        catch
        {
            await _uow.RollbackTransactionAsync(ct);
            throw;
        }
        // ─────────────────────────────────────────────────────────────────────

        try
        {
            await _audit.LogAsync(creatorUserId, "Application.Created", "CampaignApplication", app.Id);
            await _notifications.SendAsync(campaign.BrandProfile.UserId, NotificationType.NewApplication,
                $"Ny ansökan från {creator.DisplayName}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Non-critical: audit/notification failed for application {AppId}", app.Id);
        }

        return MapToDto(app, creator.DisplayName, campaign.Name);
    }

    public async Task<Result<ApplicationDto>> ApproveApplicationAsync(Guid applicationId, Guid brandUserId, string? note, CancellationToken ct = default)
    {
        var app = await _applications.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct);
        if (app == null) return Errors.NotFound("Application", applicationId);

        if (app.Campaign.BrandProfile.UserId != brandUserId)
            return Errors.Forbidden("You do not have permission to review this application");

        if (app.Status != ApplicationStatus.Pending)
            return Errors.Conflict("Can only approve pending applications");

        // Capacity re-check: the apply-time check can be stale by approval time.
        var activeCount = await _assignments.Query()
            .CountAsync(a => a.CampaignId == app.CampaignId && a.Status == AssignmentStatus.Active, ct);
        if (activeCount >= app.Campaign.MaxCreators)
            return Errors.CampaignFull;

        await _uow.BeginTransactionAsync(ct);
        try
        {
            app.Status = ApplicationStatus.Approved;
            app.ReviewedAt = DateTime.UtcNow;
            app.RejectionReason = note;

            await CreateAssignment(app.Campaign, app.CreatorProfile, app);
            await _uow.SaveChangesAsync(ct);
            await _uow.CommitTransactionAsync(ct);
        }
        catch
        {
            await _uow.RollbackTransactionAsync(ct);
            throw;
        }

        try
        {
            await _audit.LogAsync(brandUserId, "Application.Approved", "CampaignApplication", app.Id);
            await _notifications.SendAsync(app.CreatorProfile.UserId, NotificationType.ApplicationApproved,
                $"Din ansökan till {app.Campaign.Name} har godkänts!");

            // A collaboration qualifies the creator into the brand's community
            // (and onto its tap) automatically.
            await _community.EnsureMemberAsync(app.Campaign.BrandProfileId, app.CreatorProfileId, CommunityMemberSource.AutoQualified, ct);
            await _uow.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Non-critical: audit/notification failed for approved application {AppId}", app.Id);
        }

        return MapToDto(app, app.CreatorProfile.DisplayName, app.Campaign.Name);
    }

    public async Task<Result<ApplicationDto>> RejectApplicationAsync(Guid applicationId, Guid brandUserId, string? reason, CancellationToken ct = default)
    {
        var app = await _applications.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct);
        if (app == null) return Errors.NotFound("Application", applicationId);

        if (app.Campaign.BrandProfile.UserId != brandUserId)
            return Errors.Forbidden("You do not have permission to review this application");

        if (app.Status != ApplicationStatus.Pending)
            return Errors.Conflict("Can only reject pending applications");

        app.Status = ApplicationStatus.Rejected;
        app.ReviewedAt = DateTime.UtcNow;
        app.RejectionReason = reason;

        await _uow.SaveChangesAsync(ct);
        try
        {
            await _audit.LogAsync(brandUserId, "Application.Rejected", "CampaignApplication", app.Id);
            await _notifications.SendAsync(app.CreatorProfile.UserId, NotificationType.ApplicationRejected,
                $"Din ansökan till {app.Campaign.Name} har tyvärr avvisats.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Non-critical: audit/notification failed for rejected application {AppId}", app.Id);
        }

        return MapToDto(app, app.CreatorProfile.DisplayName, app.Campaign.Name);
    }

    public async Task<Result<ApplicationDto>> WithdrawApplicationAsync(Guid applicationId, Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var app = await _applications.Query()
            .Include(a => a.Campaign)
            .FirstOrDefaultAsync(a => a.Id == applicationId && a.CreatorProfileId == creator.Id, ct);
        if (app == null) return Errors.NotFound("Application", applicationId);

        if (app.Status != ApplicationStatus.Pending)
            return Errors.Conflict("Can only withdraw pending applications");

        app.Status = ApplicationStatus.Withdrawn;
        await _uow.SaveChangesAsync(ct);
        return MapToDto(app, creator.DisplayName, app.Campaign.Name);
    }

    public async Task<Result<PagedResult<ApplicationDto>>> GetCampaignApplicationsAsync(
        Guid campaignId, Guid brandUserId, string? status, int page, int pageSize, CancellationToken ct = default)
    {
        // BOLA protection: verify the brand owns this campaign
        var campaign = await _campaigns.Query()
            .Include(c => c.BrandProfile)
            .FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        if (campaign == null) return Errors.NotFound("Campaign", campaignId);
        if (campaign.BrandProfile.UserId != brandUserId)
            return Errors.Forbidden("You do not have access to this campaign's applications");

        var query = _applications.Query()
            .Include(a => a.CreatorProfile).ThenInclude(c => c.TikTokAccount)
            .Include(a => a.Campaign)
            .Where(a => a.CampaignId == campaignId);

        if (Enum.TryParse<ApplicationStatus>(status, out var s))
            query = query.Where(a => a.Status == s);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var dtos = items.Select(a => MapToDto(a, a.CreatorProfile.DisplayName, a.Campaign.Name,
            a.CreatorProfile.TikTokAccount?.TikTokUsername, a.CreatorProfile.Category, a.CreatorProfile.Bio)).ToList();
        return new PagedResult<ApplicationDto>
        {
            Data = dtos, Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<PagedResult<ApplicationDto>>> GetCreatorApplicationsAsync(
        Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var query = _applications.Query()
            .Include(a => a.Campaign)
            .Where(a => a.CreatorProfileId == creator.Id);

        if (Enum.TryParse<ApplicationStatus>(status, out var s))
            query = query.Where(a => a.Status == s);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var dtos = items.Select(a => MapToDto(a, creator.DisplayName, a.Campaign.Name)).ToList();
        return new PagedResult<ApplicationDto>
        {
            Data = dtos, Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    private async Task CreateAssignment(Campaign campaign, CreatorProfile creator, CampaignApplication app)
    {
        var assignment = new CreatorCampaignAssignment
        {
            CampaignId = campaign.Id,
            CreatorProfileId = creator.Id,
            ApplicationId = app.Id,
            Status = AssignmentStatus.Active,
            AssignedAt = DateTime.UtcNow
        };
        _assignments.Add(assignment);

        // Generate tracking tag (no hyphens – TikTok breaks hashtags at hyphens)
        var tagCode = $"CP{campaign.Id.ToString("N")[..8]}{creator.Id.ToString("N")[..6]}{Guid.NewGuid().ToString("N")[..4]}".ToUpperInvariant();
        var tag = new TrackingTag
        {
            AssignmentId = assignment.Id,
            TagCode = tagCode,
            RecommendedHashtag = campaign.RequiredHashtag,
            IsActive = true
        };
        _tags.Add(tag);
    }

    private static ApplicationDto MapToDto(CampaignApplication a, string creatorName, string campaignName,
        string? tikTokUsername = null, string? creatorCategory = null, string? creatorBio = null) =>
        new(a.Id, a.CampaignId, campaignName, a.CreatorProfileId, creatorName,
            a.Message, a.Status.ToString(), a.RejectionReason, a.ReviewedAt, a.CreatedAt,
            tikTokUsername, creatorCategory, creatorBio);

    /// <summary>Returns true when a DbUpdateException wraps a DB unique-constraint violation.</summary>
    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
        => ex.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true
        || ex.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true;
}

// ────────────────────────────────────────────────────────────────
// AssignmentService – hanterar creator-tilldelningar & submissions
// ────────────────────────────────────────────────────────────────
public class AssignmentService : IAssignmentService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<TrackingTag> _tags;
    private readonly IRepository<CreatorSubmission> _submissions;
    private readonly IRepository<SocialPost> _socialPosts;
    private readonly IAuditService _audit;
    private readonly INotificationService _notifications;
    private readonly IRepository<PayoutCalculation> _calculations;
    private readonly PayoutCalculatorFactory _payoutFactory;
    private readonly IRepository<CampaignApplication> _applicationRows;
    private readonly IRepository<BrandCommunityMember> _communityRows;
    private readonly ITikTokApiClient _tikTok;
    private readonly IEncryptionService _encryption;

    public AssignmentService(
        IUnitOfWork uow,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<CreatorProfile> creators,
        IRepository<BrandProfile> brands,
        IRepository<TrackingTag> tags,
        IRepository<CreatorSubmission> submissions,
        IRepository<SocialPost> socialPosts,
        IAuditService audit,
        INotificationService notifications,
        IRepository<PayoutCalculation> calculations,
        PayoutCalculatorFactory payoutFactory,
        IRepository<CampaignApplication> applicationRows,
        IRepository<BrandCommunityMember> communityRows,
        ITikTokApiClient tikTok,
        IEncryptionService encryption)
    {
        _applicationRows = applicationRows;
        _communityRows = communityRows;
        _tikTok = tikTok;
        _encryption = encryption;
        _uow = uow;
        _assignments = assignments;
        _creators = creators;
        _brands = brands;
        _tags = tags;
        _submissions = submissions;
        _socialPosts = socialPosts;
        _audit = audit;
        _notifications = notifications;
        _calculations = calculations;
        _payoutFactory = payoutFactory;
    }

    public async Task<Result<AssignmentDetailDto>> GetAssignmentAsync(Guid assignmentId, Guid userId, CancellationToken ct = default)
    {
        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.PayoutRules)
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .Include(a => a.TrackingTag)
            .Include(a => a.TrackingLinks)
            .Include(a => a.Submissions)
            .Include(a => a.SocialPosts)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);

        // Allow access only to the creator who owns it, or the brand that owns the campaign
        var isCreatorOwner = assignment.CreatorProfile.UserId == userId;
        var isBrandOwner   = assignment.Campaign.BrandProfile.UserId == userId;
        if (!isCreatorOwner && !isBrandOwner)
            return Errors.Forbidden("You do not have access to this assignment");

        return MapToDetail(assignment, IsGoalReached(assignment.Campaign, assignment.CurrentPayoutAmount));
    }

    public async Task<Result<PagedResult<AssignmentListDto>>> GetCreatorAssignmentsAsync(
        Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var query = _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.PayoutRules)
            .Include(a => a.TrackingLinks)
            .Where(a => a.CreatorProfileId == creator.Id);

        if (Enum.TryParse<AssignmentStatus>(status, out var s))
            query = query.Where(a => a.Status == s);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(a => a.AssignedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var dtos = items.Select(a => new AssignmentListDto(
            a.Id, a.CampaignId, a.Campaign.Name, a.Status.ToString(),
            a.TotalVerifiedViews, a.TrackingLinks.Where(tl => tl.IsActive).Sum(tl => tl.TotalClicks),
            a.CurrentPayoutAmount, a.AssignedAt,
            IsGoalReached(a.Campaign, a.CurrentPayoutAmount),
            a.Campaign.Kind == CampaignKind.Tap)).ToList();

        return new PagedResult<AssignmentListDto>
        {
            Data = dtos, Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<SubmissionDto>> SubmitVideoAsync(Guid assignmentId, Guid creatorUserId, SubmitVideoRequest request, CancellationToken ct = default)
    {
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var assignment = await _assignments.Query()
            .Include(a => a.Campaign)
            .FirstOrDefaultAsync(a => a.Id == assignmentId && a.CreatorProfileId == creator.Id, ct);
        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);

        if (assignment.Status != AssignmentStatus.Active)
            return Errors.Conflict("Assignment is not active");

        // ── Ownership gate: the video must belong to the creator's own
        //    connected TikTok account — otherwise anyone could submit someone
        //    else's viral video and collect the payout for its views. ────────
        var tiktok = creator.TikTokAccount;
        if (tiktok == null || !tiktok.IsActive)
            return Errors.Forbidden("Koppla ditt TikTok-konto innan du lägger till videos.");

        var canonicalUrl = request.VideoUrl.Trim();
        var urlMatch = Regex.Match(canonicalUrl, @"tiktok\.com/@([^/]+)/video/(\d+)");
        if (!urlMatch.Success && Regex.IsMatch(canonicalUrl, @"^https://(vm|vt)\.tiktok\.com/", RegexOptions.IgnoreCase))
        {
            var resolved = await ResolveShortLinkAsync(canonicalUrl, ct);
            if (resolved != null)
            {
                canonicalUrl = resolved;
                urlMatch = Regex.Match(canonicalUrl, @"tiktok\.com/@([^/]+)/video/(\d+)");
            }
        }
        if (!urlMatch.Success)
            return Errors.Validation("Länken kunde inte tolkas. Klistra in videons fullständiga länk: tiktok.com/@dittnamn/video/…");

        var urlUsername = urlMatch.Groups[1].Value.Trim().TrimStart('@');
        var ownUsername = (tiktok.TikTokUsername ?? "").Trim().TrimStart('@');
        if (!urlUsername.Equals(ownUsername, StringComparison.OrdinalIgnoreCase))
            return Errors.Forbidden($"Videon tillhör @{urlUsername}, men ditt kopplade konto är @{ownUsername}. Du kan bara lägga till videos från ditt eget konto.");

        // Duplicate check against the canonical URL and the video id, so the
        // same video can't be submitted twice via different link formats.
        var videoId = urlMatch.Groups[2].Value;
        var duplicate = await _submissions.Query()
            .AnyAsync(s => s.TikTokVideoUrl == canonicalUrl || s.TikTokVideoId == videoId, ct);
        if (duplicate) return Errors.Conflict("Den här videon är redan inskickad.");

        // A TikTok video exists as at most ONE tracked post (unique index), so a
        // video already claimed elsewhere must be reported in plain language
        // instead of blowing up on the database constraint.
        var existingPost = await _socialPosts.Query()
            .Include(p => p.Assignment).ThenInclude(a => a.Campaign)
            .FirstOrDefaultAsync(p => p.TikTokVideoId == videoId, ct);
        if (existingPost != null && existingPost.AssignmentId != assignmentId)
            return Errors.Conflict(
                $"Videon är redan kopplad till uppdraget \"{existingPost.Assignment?.Campaign?.Name ?? "ett annat uppdrag"}\". " +
                "En video kan bara räknas för ett uppdrag — publicera en ny video för den här kampanjen.");

        var submission = new CreatorSubmission
        {
            AssignmentId = assignmentId,
            TikTokVideoUrl = canonicalUrl,
            TikTokVideoId = videoId,
            Notes = request.Notes,
            Status = SubmissionStatus.Pending
        };
        _submissions.Add(submission);

        if (existingPost != null)
        {
            // The sync job already found this video for this assignment — attach
            // the submission to it rather than inserting a duplicate post.
            existingPost.SubmissionId = submission.Id;
            existingPost.IsActive = true;
        }
        else
        {
            _socialPosts.Add(new SocialPost
            {
                AssignmentId = assignmentId,
                SubmissionId = submission.Id,
                TikTokVideoId = videoId,
                TikTokUrl = canonicalUrl,
                Caption = request.Notes,
                PublishedAt = DateTime.UtcNow,
                VerificationStatus = VerificationStatus.Pending,
                DiscoveredAt = DateTime.UtcNow
            });
        }

        try
        {
            await _uow.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            return Errors.Conflict("Videon är redan registrerad i systemet. Ladda om sidan — den bör synas under Spårade videos.");
        }

        await _audit.LogAsync(creatorUserId, "Submission.Created", "CreatorSubmission", submission.Id);

        return new SubmissionDto(submission.Id, submission.AssignmentId, submission.TikTokVideoUrl,
            submission.TikTokVideoId, submission.Notes, submission.Status.ToString(),
            submission.RejectionReason, submission.CreatedAt);
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
        => ex.InnerException?.Message.Contains("unique", StringComparison.OrdinalIgnoreCase) == true
        || ex.InnerException?.Message.Contains("duplicate", StringComparison.OrdinalIgnoreCase) == true;

    // Shared handler: short links (vm.tiktok.com) only reveal the canonical
    // @user/video URL via their redirect — one hop, no follow, short timeout.
    private static readonly HttpClient ShortLinkClient =
        new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(6) };

    private static async Task<string?> ResolveShortLinkAsync(string url, CancellationToken ct)
    {
        try
        {
            using var resp = await ShortLinkClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            return resp.Headers.Location?.ToString();
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Fairness guarantee: a submitted video the brand has not reviewed within
    /// the window is approved automatically — creators must never wait forever
    /// on a silent brand. Both parties are notified.
    /// </summary>
    public async Task<int> AutoApprovePendingSubmissionsAsync(int olderThanHours, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddHours(-olderThanHours);
        var pending = await _submissions.Query()
            .Include(s => s.Assignment).ThenInclude(a => a.Campaign).ThenInclude(c => c.PayoutRules)
            .Include(s => s.Assignment).ThenInclude(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(s => s.Assignment).ThenInclude(a => a.CreatorProfile)
            .Where(s => s.Status == SubmissionStatus.Pending && s.CreatedAt <= cutoff)
            .ToListAsync(ct);

        foreach (var submission in pending)
        {
            submission.Status = SubmissionStatus.Approved;
            submission.ReviewedAt = DateTime.UtcNow;
            submission.RejectionReason = null;
            await ApplyReviewToVerificationAsync(submission, VerificationStatus.Verified, ct);
            await _uow.SaveChangesAsync(ct);

            var campaignName = submission.Assignment.Campaign.Name;
            await _notifications.SendAsync(submission.Assignment.CreatorProfile.UserId,
                NotificationType.SubmissionApproved,
                $"Din video i {campaignName} godkändes automatiskt — företaget granskade den inte inom {olderThanHours} timmar. Dina views räknas nu mot ersättning.");
            await _notifications.SendAsync(submission.Assignment.Campaign.BrandProfile.UserId,
                NotificationType.SystemMessage,
                $"En video i {campaignName} godkändes automatiskt eftersom den inte granskades inom {olderThanHours} timmar. Granska nya videos i tid för att behålla kontrollen.");
        }
        return pending.Count;
    }

    public async Task<Result<ActionCountsDto>> GetBrandActionCountsAsync(Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return new ActionCountsDto(0, 0, 0);

        var pendingApps = await _applicationRows.Query()
            .CountAsync(a => a.Campaign.BrandProfileId == brand.Id && a.Status == ApplicationStatus.Pending, ct);
        var pendingVideos = await _submissions.Query()
            .CountAsync(s => s.Assignment.Campaign.BrandProfileId == brand.Id && s.Status == SubmissionStatus.Pending, ct);

        var requests = await _communityRows.Query()
            .CountAsync(m => m.BrandProfileId == brand.Id && m.Status == CommunityMemberStatus.Requested, ct);

        return new ActionCountsDto(pendingApps, pendingVideos, 0, requests);
    }

    public async Task<Result<ActionCountsDto>> GetCreatorActionCountsAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return new ActionCountsDto(0, 0, 0);

        // Assignments that are live but have no tracked video yet — the
        // creator's own to-do list.
        var awaiting = await _assignments.Query()
            .CountAsync(a => a.CreatorProfileId == creator.Id
                && a.Status == AssignmentStatus.Active
                && !a.SocialPosts.Any(p => p.IsActive), ct);

        return new ActionCountsDto(0, 0, awaiting);
    }

    /// <summary>
    /// The creator's own recent TikTok videos, so content can be attached by
    /// picking it — no hashtag or tracking code in the caption required.
    /// </summary>
    public async Task<Result<List<MyTikTokVideoDto>>> GetMyTikTokVideosAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var account = creator.TikTokAccount;
        if (account == null || !account.IsActive || account.Scopes == "manual" || string.IsNullOrEmpty(account.AccessTokenEncrypted))
            return Errors.Validation("Logga in med TikTok för att kunna välja bland dina videos.");

        string token;
        try { token = _encryption.Decrypt(account.AccessTokenEncrypted); }
        catch { return Errors.Validation("TikTok-kopplingen behöver förnyas — koppla om ditt konto."); }

        List<TikTokVideo> videos;
        try { videos = await _tikTok.GetUserVideosAsync(token, DateTime.UtcNow.AddDays(-90)); }
        catch { return Errors.Validation("Kunde inte hämta dina videos från TikTok just nu. Försök igen om en stund."); }

        var ids = videos.Select(v => v.Id).ToList();
        var tracked = await _socialPosts.Query()
            .Include(p => p.Assignment).ThenInclude(a => a.Campaign)
            .Where(p => ids.Contains(p.TikTokVideoId))
            .Select(p => new { p.TikTokVideoId, CampaignName = p.Assignment.Campaign.Name })
            .ToListAsync(ct);
        var trackedBy = tracked.ToDictionary(x => x.TikTokVideoId, x => x.CampaignName);

        return videos
            .OrderByDescending(v => v.CreateTime)
            .Select(v => new MyTikTokVideoDto(
                v.Id, v.Title, v.CoverImageUrl, v.ShareUrl, v.CreateTime, v.ViewCount, v.LikeCount,
                trackedBy.ContainsKey(v.Id), trackedBy.TryGetValue(v.Id, out var name) ? name : null))
            .ToList();
    }

    public async Task<Result<TrackingTagDto>> GetTrackingTagAsync(Guid assignmentId, Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var tag = await _tags.Query()
            .Include(t => t.Assignment)
            .FirstOrDefaultAsync(t => t.AssignmentId == assignmentId
                && t.Assignment.CreatorProfileId == creator.Id, ct);
        if (tag == null) return Errors.NotFound("TrackingTag");

        return new TrackingTagDto(tag.Id, tag.TagCode, tag.RecommendedHashtag, tag.IsActive);
    }

    private static string? ExtractTikTokVideoId(string url)
    {
        // Format 1: https://www.tiktok.com/@user/video/1234567890
        var segments = url.Split('/');
        var videoIdx = Array.IndexOf(segments, "video");
        if (videoIdx >= 0 && videoIdx + 1 < segments.Length)
            return segments[videoIdx + 1].Split('?')[0];

        // Format 2: https://vm.tiktok.com/ZNR4eQ7fA/ (short link)
        if (url.Contains("vm.tiktok.com"))
        {
            var shortCode = segments.LastOrDefault(s => !string.IsNullOrEmpty(s));
            if (!string.IsNullOrEmpty(shortCode))
                return $"short_{shortCode}";
        }

        return null;
    }

    /// <summary>
    /// True when this creator cannot earn more here: the payout at an
    /// effectively infinite view count equals what they already have.
    /// Uncapped CPM never maxes out; Fixed/Tiered (and capped rules) do.
    /// </summary>
    private bool IsGoalReached(Campaign campaign, decimal currentPayout)
    {
        // Taps run month after month — they are never "done".
        if (campaign.Kind == CampaignKind.Tap) return false;
        if (currentPayout <= 0) return false;
        var rules = campaign.PayoutRules?.OrderBy(r => r.SortOrder).ToList();
        if (rules is not { Count: > 0 }) return false;
        try
        {
            var max = _payoutFactory.Create(campaign.PayoutModel).Calculate(1_000_000_000L, rules).Amount;
            return max > 0 && currentPayout >= max;
        }
        catch
        {
            return false;
        }
    }

    private static AssignmentDetailDto MapToDetail(CreatorCampaignAssignment a, bool goalReached) =>
        new(a.Id, a.CampaignId, a.Campaign.Name, a.CreatorProfileId,
            a.CreatorProfile.DisplayName, a.Status.ToString(),
            a.TotalVerifiedViews, a.TrackingLinks.Where(tl => tl.IsActive).Sum(tl => tl.TotalClicks), a.CurrentPayoutAmount,
            a.TrackingTag != null ? new TrackingTagDto(a.TrackingTag.Id, a.TrackingTag.TagCode,
                a.TrackingTag.RecommendedHashtag, a.TrackingTag.IsActive) : null,
            a.Submissions?.Select(s => new SubmissionDto(s.Id, s.AssignmentId, s.TikTokVideoUrl,
                s.TikTokVideoId, s.Notes, s.Status.ToString(), s.RejectionReason,
                s.CreatedAt)).ToList() ?? [],
            a.SocialPosts?.Where(sp => sp.IsActive).Select(sp => new SocialPostInfoDto(
                sp.Id, sp.TikTokUrl, sp.TikTokVideoId, sp.LatestViewCount,
                sp.LatestLikeCount, sp.LatestCommentCount, sp.LatestShareCount,
                sp.VerificationStatus.ToString(), sp.DiscoveredAt)).ToList() ?? [],
            a.AssignedAt, a.CompletedAt,
            a.Campaign.BrandProfile.UserId, a.CreatorProfile.UserId, goalReached);

    private static SubmissionDto MapSubmission(CreatorSubmission s) =>
        new(s.Id, s.AssignmentId, s.TikTokVideoUrl, s.TikTokVideoId,
            s.Notes, s.Status.ToString(), s.RejectionReason, s.CreatedAt);

    /// <summary>
    /// Authorizes an on-demand view sync: only the assignment's creator or the
    /// campaign's brand may trigger it (the controller enqueues the job).
    /// </summary>
    public async Task<Result<bool>> RequestViewRefreshAsync(Guid assignmentId, Guid userId, CancellationToken ct = default)
    {
        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);

        var isMember = assignment.CreatorProfile?.UserId == userId
                       || assignment.Campaign?.BrandProfile?.UserId == userId;
        if (!isMember)
            return Errors.Forbidden("You do not have access to this assignment");

        await _audit.LogAsync(userId, "Assignment.ViewRefreshRequested", "Assignment", assignmentId);
        return true;
    }

    public async Task<Result<SubmissionDto>> ApproveSubmissionAsync(Guid submissionId, Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var submission = await _submissions.Query()
            .Include(s => s.Assignment).ThenInclude(a => a.Campaign).ThenInclude(c => c.PayoutRules)
            .Include(s => s.Assignment).ThenInclude(a => a.CreatorProfile)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);
        if (submission == null) return Errors.NotFound("Submission", submissionId);

        if (submission.Assignment.Campaign.BrandProfileId != brand.Id)
            return Errors.Forbidden("Du har inte behörighet att granska denna submission");

        if (submission.Status == SubmissionStatus.Approved)
            return MapSubmission(submission); // Already approved

        submission.Status = SubmissionStatus.Approved;
        submission.ReviewedBy = brandUserId;
        submission.ReviewedAt = DateTime.UtcNow;
        submission.RejectionReason = null;
        await ApplyReviewToVerificationAsync(submission, VerificationStatus.Verified, ct);
        await _uow.SaveChangesAsync(ct);

        await _audit.LogAsync(brandUserId, "Submission.Approved", "CreatorSubmission", submission.Id);

        var creatorUserId = submission.Assignment.CreatorProfile?.UserId;
        if (creatorUserId.HasValue && creatorUserId.Value != Guid.Empty)
        {
            await _notifications.SendAsync(
                creatorUserId.Value,
                NotificationType.SubmissionApproved,
                "Din video har blivit godkänd av varumärket.",
                submission.Id);
        }

        return MapSubmission(submission);
    }

    /// <summary>
    /// A brand review decision is a human verification and overrides the
    /// confidence heuristic: recompute the assignment's verified views and the
    /// earned amount immediately instead of waiting for the next sync.
    /// </summary>
    private async Task ApplyReviewToVerificationAsync(CreatorSubmission submission, VerificationStatus newStatus, CancellationToken ct)
    {
        var posts = await _socialPosts.Query()
            .Where(p => p.AssignmentId == submission.AssignmentId && p.IsActive)
            .ToListAsync(ct);

        foreach (var post in posts.Where(p => p.SubmissionId == submission.Id))
            post.VerificationStatus = newStatus;

        var assignment = submission.Assignment;
        assignment.TotalVerifiedViews = posts
            .Where(p => p.VerificationStatus == VerificationStatus.Verified)
            .Sum(p => p.LatestViewCount);

        // Taps use monthly accounting (hard caps) — money for them is owned by
        // TapAccrualService via the recalculation job, never the lifetime calculators.
        if (assignment.Campaign?.Kind == CampaignKind.Tap) return;

        var rules = assignment.Campaign?.PayoutRules?.OrderBy(r => r.SortOrder).ToList();
        if (rules is { Count: > 0 })
        {
            var result = _payoutFactory.Create(assignment.Campaign!.PayoutModel)
                .Calculate(assignment.TotalVerifiedViews, rules);

            // A campaign can never pay out more than its budget: what other
            // creators already earned is reserved before this one is topped up.
            if (assignment.Campaign.Budget > 0)
            {
                var others = await _assignments.Query()
                    .Where(a => a.CampaignId == assignment.CampaignId && a.Id != assignment.Id)
                    .SumAsync(a => (decimal?)a.CurrentPayoutAmount, ct) ?? 0m;
                var room = Math.Max(0, assignment.Campaign.Budget - others);
                if (result.Amount > room)
                    result = result with { Amount = room };
            }
            if (result.Amount != assignment.CurrentPayoutAmount)
            {
                assignment.CurrentPayoutAmount = result.Amount;

                foreach (var stale in await _calculations.Query()
                    .Where(c => c.AssignmentId == assignment.Id && c.IsLatest).ToListAsync(ct))
                    stale.IsLatest = false;

                _calculations.Add(new PayoutCalculation
                {
                    AssignmentId = assignment.Id,
                    VerifiedViews = assignment.TotalVerifiedViews,
                    CalculatedAmount = result.Amount,
                    PayoutRuleId = result.AppliedRuleId,
                    CalculationDetails = result.Details,
                    Status = PayoutCalculationStatus.Preliminary,
                    CalculatedAt = DateTime.UtcNow
                });
            }
        }
    }

    public async Task<Result<SubmissionDto>> RejectSubmissionAsync(Guid submissionId, Guid brandUserId, string? reason, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var submission = await _submissions.Query()
            .Include(s => s.Assignment).ThenInclude(a => a.Campaign).ThenInclude(c => c.PayoutRules)
            .Include(s => s.Assignment).ThenInclude(a => a.CreatorProfile)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);
        if (submission == null) return Errors.NotFound("Submission", submissionId);

        if (submission.Assignment.Campaign.BrandProfileId != brand.Id)
            return Errors.Forbidden("Du har inte behörighet att granska denna submission");

        submission.Status = SubmissionStatus.Rejected;
        submission.ReviewedBy = brandUserId;
        submission.ReviewedAt = DateTime.UtcNow;
        submission.RejectionReason = reason;
        await ApplyReviewToVerificationAsync(submission, VerificationStatus.Rejected, ct);
        await _uow.SaveChangesAsync(ct);

        await _audit.LogAsync(brandUserId, "Submission.Rejected", "CreatorSubmission", submission.Id);

        var creatorUserId = submission.Assignment.CreatorProfile?.UserId;
        if (creatorUserId.HasValue && creatorUserId.Value != Guid.Empty)
        {
            await _notifications.SendAsync(
                creatorUserId.Value,
                NotificationType.SubmissionRejected,
                $"Din video har nekats{(string.IsNullOrEmpty(reason) ? "." : $": {reason}")}",
                submission.Id);
        }

        return MapSubmission(submission);
    }
}
