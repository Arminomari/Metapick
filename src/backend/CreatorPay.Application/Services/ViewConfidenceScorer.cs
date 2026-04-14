using CreatorPay.Domain.Entities;

namespace CreatorPay.Application.Services;

/// <summary>
/// Calculates a verification confidence score [0.0–1.0] for a TikTok social post
/// against a campaign. Used by DailyCampaignSyncJob to decide whether to count views.
/// </summary>
public static class ViewConfidenceScorer
{
    /// <summary>
    /// Scores how confident we are that a given post legitimately belongs to the campaign.
    /// </summary>
    /// <param name="post">The social post whose views are being verified.</param>
    /// <param name="account">The TikTok account that owns the post.</param>
    /// <param name="campaign">The campaign the post claims to be part of.</param>
    /// <param name="trackingTag">Optional tracking tag assigned to the creator's assignment.</param>
    /// <returns>Confidence score in [0, 1].</returns>
    public static decimal Calculate(SocialPost post, TikTokAccount account, Campaign campaign, TrackingTag? trackingTag)
    {
        decimal score = 0;

        // Signal 1: Account verified via OAuth & active (weight 0.30)
        if (account.IsActive) score += 0.15m;
        if (account.ConnectedAt < DateTime.UtcNow.AddMonths(-1)) score += 0.15m;

        // Signal 2: Post within campaign period (weight 0.20)
        if (post.PublishedAt >= campaign.StartDate && post.PublishedAt <= campaign.EndDate.AddHours(24))
            score += 0.20m;

        // Signal 3: Required hashtag present (weight 0.20)
        if (!string.IsNullOrEmpty(campaign.RequiredHashtag) &&
            post.Caption?.Contains(campaign.RequiredHashtag, StringComparison.OrdinalIgnoreCase) == true)
            score += 0.20m;

        // Signal 4: Tracking tag present (weight 0.25)
        if (trackingTag != null && !string.IsNullOrEmpty(trackingTag.TagCode) &&
            post.Caption?.Contains(trackingTag.TagCode, StringComparison.OrdinalIgnoreCase) == true)
            score += 0.25m;

        // Signal 5: Non-duplicate baseline (weight 0.05) — duplicates are flagged separately
        score += 0.05m;

        return Math.Min(score, 1.0m);
    }
}
