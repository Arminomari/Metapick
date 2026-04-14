using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Application.Services;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Worker.Jobs;

/// <summary>
/// DailyCampaignSyncJob – synkroniserar TikTok-metrics för alla aktiva kampanjer.
/// Ansvar: hämta videos, uppdatera metrics, skapa snapshots, verifiera views.
/// Utbetalningsberäkning hanteras av <see cref="PayoutRecalculationJob"/>.
/// Bedrägerikontroll hanteras av <see cref="FraudDetectionJob"/>.
/// </summary>
public class DailyCampaignSyncJob : ICampaignSyncTrigger
{
    private readonly ILogger<DailyCampaignSyncJob> _logger;
    private readonly IRepository<Campaign> _campaigns;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<SocialPost> _socialPosts;
    private readonly IRepository<SocialPostMetricSnapshot> _snapshots;
    private readonly IRepository<ViewVerificationRecord> _verifications;
    private readonly IUnitOfWork _uow;
    private readonly ITikTokApiClient _tikTok;
    private readonly IEncryptionService _encryption;
    private readonly IFraudService _fraud;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;

    public DailyCampaignSyncJob(
        ILogger<DailyCampaignSyncJob> logger,
        IRepository<Campaign> campaigns,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<SocialPost> socialPosts,
        IRepository<SocialPostMetricSnapshot> snapshots,
        IRepository<ViewVerificationRecord> verifications,
        IUnitOfWork uow,
        ITikTokApiClient tikTok,
        IEncryptionService encryption,
        IFraudService fraud,
        INotificationService notifications,
        IAuditService audit)
    {
        _logger = logger;
        _campaigns = campaigns;
        _assignments = assignments;
        _socialPosts = socialPosts;
        _snapshots = snapshots;
        _verifications = verifications;
        _uow = uow;
        _tikTok = tikTok;
        _encryption = encryption;
        _fraud = fraud;
        _notifications = notifications;
        _audit = audit;
    }

    public async Task ExecuteAsync()
    {
        _logger.LogInformation("DailyCampaignSync started at {Time}", DateTime.UtcNow);

        const int batchSize = 50;
        int skip = 0;
        int totalProcessed = 0;

        while (true)
        {
            var batch = await _campaigns.Query()
                .Include(c => c.PayoutRules)
                .Include(c => c.Assignments).ThenInclude(a => a.CreatorProfile).ThenInclude(cp => cp!.TikTokAccount)
                .Include(c => c.Assignments).ThenInclude(a => a.Submissions)
                .Include(c => c.Assignments).ThenInclude(a => a.TrackingTag)
                .Where(c => c.Status == CampaignStatus.Active && !c.IsDeleted)
                .OrderBy(c => c.Id)
                .Skip(skip)
                .Take(batchSize)
                .ToListAsync();

            if (!batch.Any()) break;

            _logger.LogInformation("Processing batch of {Count} campaigns (offset {Skip})", batch.Count, skip);

            foreach (var campaign in batch)
            {
                await _uow.BeginTransactionAsync();
                try
                {
                    await ProcessCampaignAsync(campaign);
                    await _uow.SaveChangesAsync();
                    await _uow.CommitTransactionAsync();
                    _logger.LogInformation("Campaign {Id} synced and committed", campaign.Id);
                }
                catch (Exception ex)
                {
                    await _uow.RollbackTransactionAsync();
                    _logger.LogError(ex, "Failed to sync campaign {CampaignId}: {Name} — rolled back", campaign.Id, campaign.Name);
                }
            }

            totalProcessed += batch.Count;
            skip += batchSize;

            if (batch.Count < batchSize) break;
        }

        _logger.LogInformation("DailyCampaignSync completed at {Time} — {Total} campaigns processed", DateTime.UtcNow, totalProcessed);
    }

    private async Task ProcessCampaignAsync(Campaign campaign)
    {
        _logger.LogInformation("Processing campaign {Id}: {Name}", campaign.Id, campaign.Name);

        var activeAssignments = campaign.Assignments
            .Where(a => a.Status == AssignmentStatus.Active)
            .ToList();

        foreach (var assignment in activeAssignments)
        {
            try
            {
                await ProcessAssignmentAsync(campaign, assignment);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process assignment {AssignmentId}", assignment.Id);
            }
        }

        // Update campaign budget spent
        campaign.BudgetSpent = campaign.Assignments
            .Where(a => a.Status == AssignmentStatus.Active || a.Status == AssignmentStatus.Completed)
            .Sum(a => a.CurrentPayoutAmount);

        // Warn if budget exceeded 90%
        if (campaign.Budget > 0 && campaign.BudgetSpent >= campaign.Budget * 0.9m)
        {
            _logger.LogWarning("Campaign {Id} budget at {Pct}% – sending warning",
                campaign.Id, (campaign.BudgetSpent / campaign.Budget * 100));

            await _notifications.SendAsync(campaign.BrandProfileId, NotificationType.SystemMessage,
                $"Kampanjen '{campaign.Name}' har förbrukat {campaign.BudgetSpent:N0} av {campaign.Budget:N0} SEK");
        }
    }

    private async Task ProcessAssignmentAsync(Campaign campaign, CreatorCampaignAssignment assignment)
    {
        var tikTokAccount = assignment.CreatorProfile?.TikTokAccount;
        if (tikTokAccount == null || !tikTokAccount.IsActive || string.IsNullOrEmpty(tikTokAccount.AccessTokenEncrypted))
        {
            _logger.LogWarning("Assignment {Id} has no active TikTok account", assignment.Id);
            return;
        }

        // Decrypt access token
        string accessToken;
        try
        {
            accessToken = _encryption.Decrypt(tikTokAccount.AccessTokenEncrypted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to decrypt access token for {Username}", tikTokAccount.TikTokUsername);
            return;
        }

        // Step 1: Fetch latest videos from TikTok API
        List<TikTokVideo> videos;
        try
        {
            videos = await _tikTok.GetUserVideosAsync(accessToken, campaign.StartDate);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TikTok API call failed for {Username}", tikTokAccount.TikTokUsername);
            return;
        }

        // Update last sync timestamp
        tikTokAccount.LastSyncAt = DateTime.UtcNow;

        // Step 2: Get existing tracked posts for this assignment
        var existingPosts = await _socialPosts.Query()
            .Where(p => p.AssignmentId == assignment.Id && p.IsActive)
            .ToListAsync();

        var existingVideoIds = existingPosts.Select(p => p.TikTokVideoId).ToHashSet();
        var trackingTag = assignment.TrackingTag;

        // Step 3: Discover new videos that match the campaign
        foreach (var video in videos)
        {
            if (existingVideoIds.Contains(video.Id))
                continue;

            // Check if video matches: must be within campaign period
            if (video.CreateTime < campaign.StartDate || video.CreateTime > campaign.EndDate.AddHours(24))
                continue;

            // Build caption from title + description for matching
            var caption = $"{video.Title} {video.Description}".Trim();

            // Check for hashtag or tracking tag match
            bool hasHashtag = !string.IsNullOrEmpty(campaign.RequiredHashtag) &&
                              caption.Contains(campaign.RequiredHashtag, StringComparison.OrdinalIgnoreCase);
            bool hasTrackingTag = trackingTag != null &&
                                  caption.Contains(trackingTag.TagCode, StringComparison.OrdinalIgnoreCase);

            if (!hasHashtag && !hasTrackingTag)
                continue;

            _logger.LogInformation("Discovered new matching video {VideoId} for assignment {AssignmentId}",
                video.Id, assignment.Id);

            var newPost = new SocialPost
            {
                AssignmentId = assignment.Id,
                TikTokVideoId = video.Id,
                TikTokUrl = video.ShareUrl,
                Caption = caption,
                Duration = video.Duration,
                PublishedAt = video.CreateTime,
                LatestViewCount = video.ViewCount,
                LatestLikeCount = video.LikeCount,
                LatestCommentCount = video.CommentCount,
                LatestShareCount = video.ShareCount,
                VerificationStatus = VerificationStatus.Pending,
                DiscoveredAt = DateTime.UtcNow
            };
            _socialPosts.Add(newPost);
            existingPosts.Add(newPost);
        }

        // Step 4: Update metrics for all tracked posts
        long totalVerifiedViews = 0;

        foreach (var post in existingPosts)
        {
            var video = videos.FirstOrDefault(v => v.Id == post.TikTokVideoId);
            if (video == null)
            {
                _logger.LogWarning("Could not find video for post {PostId}", post.TikTokVideoId);
                continue;
            }

            // Step 4: Create metric snapshot
            var previousViews = post.LatestViewCount;
            var snapshot = new SocialPostMetricSnapshot
            {
                SocialPostId = post.Id,
                ViewCount = video.ViewCount,
                LikeCount = video.LikeCount,
                CommentCount = video.CommentCount,
                ShareCount = video.ShareCount,
                SnapshotDate = DateOnly.FromDateTime(DateTime.UtcNow),
                Source = MetricSource.ApiAutomatic
            };
            _snapshots.Add(snapshot);

            // Update post metrics
            post.LatestViewCount = video.ViewCount;
            post.LatestLikeCount = video.LikeCount;
            post.LatestCommentCount = video.CommentCount;
            post.LatestShareCount = video.ShareCount;

            // Step 5: Fraud check – if views increased > 500% in 24h
            if (previousViews > 0)
            {
                var growthRate = (double)(video.ViewCount - previousViews) / previousViews;
                if (growthRate > 5.0)
                {
                    _logger.LogWarning("Suspicious growth for post {PostId}: {Rate:P0}", post.TikTokVideoId, growthRate);
                    try
                    {
                        await _fraud.CreateFraudFlagAsync(new CreateFraudFlagRequest(
                            "SocialPost", post.Id, "SuspiciousViewGrowth", "High",
                            $"Views ökade med {growthRate:P0} på 24h (från {previousViews} till {video.ViewCount})"));
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to create fraud flag for post {PostId}", post.Id);
                    }
                    post.VerificationStatus = VerificationStatus.Failed;
                    continue;
                }
            }

            // Step 5: Verify views (confidence scoring)
            var confidence = ViewConfidenceScorer.Calculate(post, tikTokAccount, campaign, trackingTag);
            var verification = new ViewVerificationRecord
            {
                SocialPostId = post.Id,
                VerifiedViewCount = video.ViewCount,
                PeakViewCount = video.ViewCount,
                ConfidenceScore = confidence,
                VerificationMethod = VerificationMethod.Automatic,
                VerifiedAt = DateTime.UtcNow,
                Notes = $"Auto-verifierad med confidence {confidence:F2}"
            };
            _verifications.Add(verification);

            if (confidence >= 0.7m)
            {
                post.VerificationStatus = VerificationStatus.Verified;
                totalVerifiedViews += video.ViewCount;
            }
            else if (confidence >= 0.4m)
            {
                post.VerificationStatus = VerificationStatus.Pending;
            }
            else
            {
                post.VerificationStatus = VerificationStatus.Failed;
            }
        }

        // Step 6: Update assignment verified views
        assignment.TotalVerifiedViews = totalVerifiedViews;

        _logger.LogDebug("Assignment {Id}: {Views} verified views recorded",
            assignment.Id, totalVerifiedViews);
    }

    /// <summary>
    /// Beräknar confidence score (0.0 – 1.0) baserat på 5 signaler.
    /// </summary>
}
