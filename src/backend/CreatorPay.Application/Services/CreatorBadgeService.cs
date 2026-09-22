using CreatorPay.Domain.Common;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

/// <summary>
/// Platform-wide inputs the badge rules need: the verified-view distribution
/// for "Top creator" and the verified TikTok posts a portfolio item may match.
/// </summary>
public class CreatorBadgeService
{
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private long? _threshold;
    private bool _thresholdLoaded;

    public CreatorBadgeService(IRepository<CreatorCampaignAssignment> assignments) => _assignments = assignments;

    /// <summary>Verified views per approved creator across campaigns and taps that ran, once per request.</summary>
    public async Task<long?> TopCreatorThresholdAsync(CancellationToken ct = default)
    {
        if (_thresholdLoaded) return _threshold;
        var perCreator = await _assignments.Query()
            .Where(a => !a.Campaign.IsDeleted && a.CreatorProfile.Status == CreatorStatus.Approved
                && (a.Status == AssignmentStatus.Active || a.Status == AssignmentStatus.Completed))
            .GroupBy(a => a.CreatorProfileId)
            .Select(g => g.Sum(a => a.TotalVerifiedViews))
            .ToListAsync(ct);
        _threshold = CreatorBadges.TopCreatorThreshold(perCreator);
        _thresholdLoaded = true;
        return _threshold;
    }

    public sealed record VerifiedPost(string TikTokVideoId, long Views, long Likes, DateTime? MetricsUpdatedAt);

    /// <summary>The creator's own verified campaign videos, keyed by TikTok video id.</summary>
    public async Task<Dictionary<string, VerifiedPost>> VerifiedPostsAsync(Guid creatorProfileId, CancellationToken ct = default)
    {
        var rows = await _assignments.Query()
            .Where(a => a.CreatorProfileId == creatorProfileId && !a.Campaign.IsDeleted)
            .SelectMany(a => a.SocialPosts)
            .Where(sp => sp.IsActive && sp.VerificationStatus == VerificationStatus.Verified)
            .Select(sp => new VerifiedPost(sp.TikTokVideoId, sp.LatestViewCount, sp.LatestLikeCount, sp.MetricsUpdatedAt))
            .ToListAsync(ct);
        var dict = new Dictionary<string, VerifiedPost>();
        foreach (var r in rows) dict[r.TikTokVideoId] = r;
        return dict;
    }
}
