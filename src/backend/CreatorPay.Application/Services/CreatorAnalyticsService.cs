using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Common;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

/// <summary>Pure aggregation over a creator's assignments and payout ledger.</summary>
public static class CreatorAnalyticsCalculator
{
    public static bool Counted(CreatorCampaignAssignment a) =>
        a.Status is AssignmentStatus.Active or AssignmentStatus.Paused or AssignmentStatus.Completed;

    public static CreatorLevelDto Level(decimal totalPaid)
    {
        var tier = CreatorLevels.For(totalPaid);
        var next = CreatorLevels.Next(tier);
        return new CreatorLevelDto(tier.Index, tier.Name, tier.MinPaid, totalPaid, next?.Name, next?.MinPaid,
            CreatorLevels.ProgressPercent(totalPaid),
            CreatorLevels.Tiers.Select(x => new CreatorLevelTierDto(x.Index, x.Name, x.MinPaid)).ToList());
    }

    public static CreatorAnalyticsDto Compute(
        CreatorProfile creator,
        IReadOnlyList<CreatorCampaignAssignment> assignments,
        IReadOnlyList<PayoutRequest> payouts,
        IReadOnlyList<TapAccrual> tapAccrualsThisMonth,
        decimal prValueDeclared,
        decimal availableToWithdraw,
        DateTime nowUtc,
        long? topCreatorThreshold = null)
    {
        var counted = assignments.Where(Counted).ToList();
        var posts = counted.SelectMany(a => a.SocialPosts.Where(sp => sp.IsActive)).ToList();
        var verifiedPosts = posts.Count(sp => sp.VerificationStatus == VerificationStatus.Verified);

        var views = counted.Sum(a => a.TotalVerifiedViews);
        var clicks = counted.Sum(a => a.TrackingLinks.Where(l => l.IsActive).Sum(l => l.TotalClicks));
        var earned = counted.Sum(a => a.CurrentPayoutAmount);
        var active = counted.Count(a => a.Status == AssignmentStatus.Active);
        var completed = counted.Count(a => a.Status == AssignmentStatus.Completed);

        var live = payouts.Where(p => p.Status != PayoutStatus.Rejected).ToList();
        var paid = live.Where(p => p.Status == PayoutStatus.Completed).Sum(p => p.RequestedAmount);
        var approved = live.Where(p => p.Status is PayoutStatus.Approved or PayoutStatus.Processing).Sum(p => p.RequestedAmount);
        var pending = live.Where(p => p.Status is PayoutStatus.Pending or PayoutStatus.UnderReview).Sum(p => p.RequestedAmount);
        var accrued = Math.Max(0, earned - paid - approved - pending);
        var paidCount = live.Count(p => p.Status == PayoutStatus.Completed);

        var tapAssignments = counted.Where(a => a.Campaign.Kind == CampaignKind.Tap).ToList();
        var tapIds = tapAssignments.Select(a => a.Id).ToHashSet();

        var rows = counted
            .OrderByDescending(a => a.TotalVerifiedViews)
            .Select(a => new CreatorCampaignRowDto(
                a.Id, a.CampaignId, a.Campaign.Name, a.Campaign.BrandProfileId,
                a.Campaign.BrandProfile?.CompanyName ?? "", a.Status.ToString(), a.Campaign.Kind == CampaignKind.Tap,
                a.TotalVerifiedViews, a.TrackingLinks.Where(l => l.IsActive).Sum(l => l.TotalClicks), a.CurrentPayoutAmount,
                a.AssignedAt, a.SocialPosts.Where(sp => sp.IsActive).Max(sp => sp.MetricsUpdatedAt)))
            .ToList();

        var topBrands = counted
            .GroupBy(a => a.Campaign.BrandProfileId)
            .Select(g => new CreatorBrandRowDto(g.Key, g.First().Campaign.BrandProfile?.CompanyName ?? "",
                g.Sum(a => a.CurrentPayoutAmount), g.Sum(a => a.TotalVerifiedViews)))
            .Where(b => b.Earned > 0)
            .OrderByDescending(b => b.Earned)
            .Take(5)
            .ToList();

        var decided = counted.SelectMany(a => a.Submissions)
            .Where(sub => sub.Status is SubmissionStatus.Approved or SubmissionStatus.Rejected).ToList();
        var approvedVideos = decided.Count(sub => sub.Status == SubmissionStatus.Approved);

        var tt = creator.TikTokAccount;
        return new CreatorAnalyticsDto(
            nowUtc,
            posts.Max(sp => sp.MetricsUpdatedAt),
            views, clicks, views > 0 ? Math.Round(clicks * 100.0 / views, 2) : null, verifiedPosts,
            active, completed, counted.Count > 0 ? views / counted.Count : null,
            earned, views > 0 ? Math.Round(earned / views * 1000m, 2) : null,
            paid, approved, pending, accrued, availableToWithdraw,
            live.Count, live.Count > 0 ? Math.Round((paid + approved + pending) / live.Count, 2) : null,
            live.Count > 0 ? Math.Round(paidCount * 100.0 / live.Count, 1) : null,
            tapAccrualsThisMonth.Where(x => tapIds.Contains(x.AssignmentId)).Sum(x => x.Amount),
            tapAssignments.Sum(a => a.CurrentPayoutAmount), tapAssignments.Count,
            prValueDeclared,
            Level(paid),
            tt.IsVerified(), tt?.TikTokUsername, tt.VerifiedFollowers(), tt.FollowersSyncedAt(),
            rows, topBrands,
            approvedVideos, decided.Count, decided.Count > 0 ? Math.Round(approvedVideos * 100.0 / decided.Count, 1) : null,
            CreatorBadges.IsVerifiedCreator(tt.IsVerified(), verifiedPosts),
            CreatorBadges.IsTopCreator(views, verifiedPosts, topCreatorThreshold));
    }
}

public class CreatorAnalyticsService : ICreatorAnalyticsService
{
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<PayoutRequest> _payouts;
    private readonly IRepository<TapAccrual> _accruals;
    private readonly IRepository<PrOffer> _prOffers;
    private readonly IPayoutService _payoutService;
    private readonly CreatorBadgeService _badges;

    public CreatorAnalyticsService(
        IRepository<CreatorProfile> creators,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<PayoutRequest> payouts,
        IRepository<TapAccrual> accruals,
        IRepository<PrOffer> prOffers,
        IPayoutService payoutService,
        CreatorBadgeService badges)
    {
        _creators = creators;
        _assignments = assignments;
        _payouts = payouts;
        _accruals = accruals;
        _prOffers = prOffers;
        _payoutService = payoutService;
        _badges = badges;
    }

    public async Task<Result<CreatorAnalyticsDto>> GetAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().Include(c => c.TikTokAccount).FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator profile");

        var assignments = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.SocialPosts)
            .Include(a => a.TrackingLinks)
            .Include(a => a.Submissions)
            .Where(a => a.CreatorProfileId == creator.Id && !a.Campaign.IsDeleted)
            .ToListAsync(ct);

        var payouts = await _payouts.Query()
            .Where(p => p.CreatorProfileId == creator.Id)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var ids = assignments.Select(a => a.Id).ToList();
        var accruals = await _accruals.Query()
            .Where(x => ids.Contains(x.AssignmentId) && x.Year == now.Year && x.Month == now.Month)
            .ToListAsync(ct);

        var prDeclared = await _prOffers.Query()
            .Where(o => o.CreatorProfileId == creator.Id && (o.Status == PrOfferStatus.Accepted || o.Status == PrOfferStatus.Completed))
            .SumAsync(o => (o.CompensationAmount ?? 0m) + (o.ProductValue ?? 0m), ct);

        var payables = await _payoutService.GetPayablesAsync(creatorUserId, ct);
        var available = payables.IsSuccess ? payables.Value!.Sum(p => p.Available) : 0m;

        var topThreshold = await _badges.TopCreatorThresholdAsync(ct);
        return CreatorAnalyticsCalculator.Compute(creator, assignments, payouts, accruals, prDeclared, available, now, topThreshold);
    }
}
