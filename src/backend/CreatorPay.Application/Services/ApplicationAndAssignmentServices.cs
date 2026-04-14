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

    public ApplicationService(
        IUnitOfWork uow,
        IRepository<CampaignApplication> applications,
        IRepository<Campaign> campaigns,
        IRepository<CreatorProfile> creators,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<TrackingTag> tags,
        IAuditService audit,
        INotificationService notifications,
        ILogger<ApplicationService> logger)
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
    }

    public async Task<Result<ApplicationDto>> ApplyToCampaignAsync(Guid creatorUserId, ApplyToCampaignRequest request, CancellationToken ct = default)
    {
        // Pre-flight reads — no locking needed
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.Forbidden("Creator profile not found");

        var campaign = await _campaigns.Query()
            .Include(c => c.BrandProfile)
            .FirstOrDefaultAsync(c => c.Id == request.CampaignId, ct);
        if (campaign == null) return Errors.NotFound("Campaign", request.CampaignId);
        if (campaign.Status != CampaignStatus.Active)
            return Errors.Conflict("Campaign is not accepting applications");

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
                app.RejectionReason = "Auto-godkänd";
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

    public AssignmentService(
        IUnitOfWork uow,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<CreatorProfile> creators,
        IRepository<BrandProfile> brands,
        IRepository<TrackingTag> tags,
        IRepository<CreatorSubmission> submissions,
        IRepository<SocialPost> socialPosts,
        IAuditService audit,
        INotificationService notifications)
    {
        _uow = uow;
        _assignments = assignments;
        _creators = creators;
        _brands = brands;
        _tags = tags;
        _submissions = submissions;
        _socialPosts = socialPosts;
        _audit = audit;
        _notifications = notifications;
    }

    public async Task<Result<AssignmentDetailDto>> GetAssignmentAsync(Guid assignmentId, Guid userId, CancellationToken ct = default)
    {
        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.PayoutRules)
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .Include(a => a.TrackingTag)
            .Include(a => a.Submissions)
            .Include(a => a.SocialPosts)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);

        // Allow access only to the creator who owns it, or the brand that owns the campaign
        var isCreatorOwner = assignment.CreatorProfile.UserId == userId;
        var isBrandOwner   = assignment.Campaign.BrandProfile.UserId == userId;
        if (!isCreatorOwner && !isBrandOwner)
            return Errors.Forbidden("You do not have access to this assignment");

        return MapToDetail(assignment);
    }

    public async Task<Result<PagedResult<AssignmentListDto>>> GetCreatorAssignmentsAsync(
        Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var query = _assignments.Query()
            .Include(a => a.Campaign)
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
            a.TotalVerifiedViews, a.CurrentPayoutAmount, a.AssignedAt)).ToList();

        return new PagedResult<AssignmentListDto>
        {
            Data = dtos, Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<SubmissionDto>> SubmitVideoAsync(Guid assignmentId, Guid creatorUserId, SubmitVideoRequest request, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var assignment = await _assignments.Query()
            .Include(a => a.Campaign)
            .FirstOrDefaultAsync(a => a.Id == assignmentId && a.CreatorProfileId == creator.Id, ct);
        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);

        if (assignment.Status != AssignmentStatus.Active)
            return Errors.Conflict("Assignment is not active");

        // Check for duplicate URL
        var duplicate = await _submissions.Query()
            .AnyAsync(s => s.TikTokVideoUrl == request.VideoUrl, ct);
        if (duplicate) return Errors.Conflict("This video URL has already been submitted");

        var submission = new CreatorSubmission
        {
            AssignmentId = assignmentId,
            TikTokVideoUrl = request.VideoUrl,
            TikTokVideoId = ExtractTikTokVideoId(request.VideoUrl),
            Notes = request.Notes,
            Status = SubmissionStatus.Pending
        };

        // Create a SocialPost linked to this submission so the daily sync job can track views
        var socialPost = new SocialPost
        {
            AssignmentId = assignmentId,
            SubmissionId = submission.Id,
            TikTokVideoId = submission.TikTokVideoId ?? "",
            TikTokUrl = submission.TikTokVideoUrl,
            Caption = request.Notes,
            PublishedAt = DateTime.UtcNow,
            VerificationStatus = VerificationStatus.Pending,
            DiscoveredAt = DateTime.UtcNow
        };

        _submissions.Add(submission);
        _socialPosts.Add(socialPost);
        await _uow.SaveChangesAsync(ct);

        await _audit.LogAsync(creatorUserId, "Submission.Created", "CreatorSubmission", submission.Id);

        return new SubmissionDto(submission.Id, submission.AssignmentId, submission.TikTokVideoUrl,
            submission.TikTokVideoId, submission.Notes, submission.Status.ToString(),
            submission.RejectionReason, submission.CreatedAt);
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

    private static AssignmentDetailDto MapToDetail(CreatorCampaignAssignment a) =>
        new(a.Id, a.CampaignId, a.Campaign.Name, a.CreatorProfileId,
            a.CreatorProfile.DisplayName, a.Status.ToString(),
            a.TotalVerifiedViews, a.CurrentPayoutAmount,
            a.TrackingTag != null ? new TrackingTagDto(a.TrackingTag.Id, a.TrackingTag.TagCode,
                a.TrackingTag.RecommendedHashtag, a.TrackingTag.IsActive) : null,
            a.Submissions?.Select(s => new SubmissionDto(s.Id, s.AssignmentId, s.TikTokVideoUrl,
                s.TikTokVideoId, s.Notes, s.Status.ToString(), s.RejectionReason,
                s.CreatedAt)).ToList() ?? [],
            a.SocialPosts?.Where(sp => sp.IsActive).Select(sp => new SocialPostInfoDto(
                sp.Id, sp.TikTokUrl, sp.TikTokVideoId, sp.LatestViewCount,
                sp.LatestLikeCount, sp.LatestCommentCount, sp.LatestShareCount,
                sp.VerificationStatus.ToString(), sp.DiscoveredAt)).ToList() ?? [],
            a.AssignedAt, a.CompletedAt);

    private static SubmissionDto MapSubmission(CreatorSubmission s) =>
        new(s.Id, s.AssignmentId, s.TikTokVideoUrl, s.TikTokVideoId,
            s.Notes, s.Status.ToString(), s.RejectionReason, s.CreatedAt);

    public async Task<Result<SubmissionDto>> ApproveSubmissionAsync(Guid submissionId, Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var submission = await _submissions.Query()
            .Include(s => s.Assignment).ThenInclude(a => a.Campaign)
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

    public async Task<Result<SubmissionDto>> RejectSubmissionAsync(Guid submissionId, Guid brandUserId, string? reason, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var submission = await _submissions.Query()
            .Include(s => s.Assignment).ThenInclude(a => a.Campaign)
            .Include(s => s.Assignment).ThenInclude(a => a.CreatorProfile)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);
        if (submission == null) return Errors.NotFound("Submission", submissionId);

        if (submission.Assignment.Campaign.BrandProfileId != brand.Id)
            return Errors.Forbidden("Du har inte behörighet att granska denna submission");

        submission.Status = SubmissionStatus.Rejected;
        submission.ReviewedBy = brandUserId;
        submission.ReviewedAt = DateTime.UtcNow;
        submission.RejectionReason = reason;
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
