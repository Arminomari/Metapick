using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Common;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

// ────────────────────────────────────────────────────────────────
// PortfolioService — creators manage their showcased work
// ────────────────────────────────────────────────────────────────
public class PortfolioService : IPortfolioService
{
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<PortfolioItem> _items;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<UgcCollab> _collabs;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IUnitOfWork _uow;
    private readonly CreatorBadgeService _badges;

    public PortfolioService(
        IRepository<CreatorProfile> creators, IRepository<PortfolioItem> items,
        IRepository<CreatorCampaignAssignment> assignments, IRepository<UgcCollab> collabs,
        IRepository<BrandProfile> brands, IUnitOfWork uow, CreatorBadgeService badges)
    {
        _creators = creators;
        _items = items;
        _assignments = assignments;
        _collabs = collabs;
        _brands = brands;
        _uow = uow;
        _badges = badges;
    }

    public async Task<Result<List<PortfolioItemDto>>> GetMyPortfolioAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator profile");

        var items = await _items.Query()
            .Where(p => p.CreatorProfileId == creator.Id)
            .OrderByDescending(p => p.IsFeatured)
            .ThenBy(p => p.SortOrder)
            .ThenByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        var verified = await _badges.VerifiedPostsAsync(creator.Id, ct);
        return items.Select(p => MapToDto(p, verified)).ToList();
    }

    /// <summary>
    /// The real collaborations a creator can attach a portfolio item to: campaign
    /// and tap assignments that ran, and UGC orders that were approved or paid.
    /// </summary>
    public async Task<Result<List<CreatorCollaborationDto>>> GetMyCollaborationsAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator profile");

        var assignments = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Where(a => a.CreatorProfileId == creator.Id && !a.Campaign.IsDeleted
                && (a.Status == AssignmentStatus.Active || a.Status == AssignmentStatus.Completed))
            .ToListAsync(ct);

        var collabs = await _collabs.Query()
            .Where(x => x.CreatorProfileId == creator.Id
                && (x.Status == UgcCollabStatus.Approved || x.Status == UgcCollabStatus.Paid))
            .ToListAsync(ct);
        var brandIds = collabs.Select(x => x.BrandProfileId).Distinct().ToList();
        var brandNames = await _brands.Query().Where(b => brandIds.Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b.CompanyName, ct);

        var rows = assignments.Select(a => new CreatorCollaborationDto(
                a.Campaign.Kind == CampaignKind.Tap ? "Tap" : "Campaign", a.CampaignId,
                a.Campaign.BrandProfileId, a.Campaign.BrandProfile.CompanyName, a.Campaign.Name,
                a.Status.ToString(), a.CompletedAt ?? a.AssignedAt))
            .Concat(collabs.Select(x => new CreatorCollaborationDto(
                "Ugc", x.Id, x.BrandProfileId, brandNames.GetValueOrDefault(x.BrandProfileId, ""), x.Title,
                x.Status.ToString(), x.PaidAt ?? x.ApprovedAt ?? x.CreatedAt)))
            .OrderByDescending(r => r.At)
            .ToList();
        return rows;
    }

    public async Task<Result<PortfolioItemDto>> AddItemAsync(Guid creatorUserId, CreatePortfolioItemRequest request, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator profile");

        var validation = Validate(request.Title, request.MediaType, request.MediaUrl, out var mediaType)
            ?? ValidateOptionalUrl(request.ThumbnailUrl, "Thumbnail URL");
        if (validation != null) return validation;

        var link = await ResolveLinkAsync(creator.Id, request.CampaignId, request.UgcCollabId, ct);
        if (!link.IsSuccess) return link.Error!;

        var maxSort = await _items.Query()
            .Where(p => p.CreatorProfileId == creator.Id)
            .Select(p => (int?)p.SortOrder).MaxAsync(ct) ?? -1;

        var item = new PortfolioItem
        {
            CreatorProfileId = creator.Id,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            MediaType = mediaType,
            MediaUrl = request.MediaUrl.Trim(),
            ThumbnailUrl = string.IsNullOrWhiteSpace(request.ThumbnailUrl) ? null : request.ThumbnailUrl.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
            IsFeatured = request.IsFeatured,
            SortOrder = maxSort + 1,
        };
        ApplyLink(item, link.Value!, request.BrandName);

        _items.Add(item);
        await _uow.SaveChangesAsync(ct);
        return MapToDto(item);
    }

    public async Task<Result<PortfolioItemDto>> UpdateItemAsync(Guid itemId, Guid creatorUserId, UpdatePortfolioItemRequest request, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator profile");

        var item = await _items.Query().FirstOrDefaultAsync(p => p.Id == itemId, ct);
        if (item == null) return Errors.NotFound("Portfolio item", itemId);
        if (item.CreatorProfileId != creator.Id) return Errors.Forbidden("Not your portfolio item");

        var validation = Validate(request.Title, request.MediaType, request.MediaUrl, out var mediaType)
            ?? ValidateOptionalUrl(request.ThumbnailUrl, "Thumbnail URL");
        if (validation != null) return validation;

        var link = await ResolveLinkAsync(creator.Id, request.CampaignId, request.UgcCollabId, ct);
        if (!link.IsSuccess) return link.Error!;

        item.Title = request.Title.Trim();
        item.Description = request.Description?.Trim();
        item.MediaType = mediaType;
        item.MediaUrl = request.MediaUrl.Trim();
        item.ThumbnailUrl = string.IsNullOrWhiteSpace(request.ThumbnailUrl) ? null : request.ThumbnailUrl.Trim();
        item.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
        item.SortOrder = request.SortOrder;
        item.IsFeatured = request.IsFeatured;
        ApplyLink(item, link.Value!, request.BrandName);

        await _uow.SaveChangesAsync(ct);
        return MapToDto(item);
    }

    public async Task<Result<bool>> DeleteItemAsync(Guid itemId, Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator profile");

        var item = await _items.Query().FirstOrDefaultAsync(p => p.Id == itemId, ct);
        if (item == null) return Errors.NotFound("Portfolio item", itemId);
        if (item.CreatorProfileId != creator.Id) return Errors.Forbidden("Not your portfolio item");

        _items.Remove(item);
        await _uow.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>A resolved collaboration link: null brand = unverified free-text claim.</summary>
    public sealed record ResolvedLink(Guid? CampaignId, Guid? UgcCollabId, Guid? BrandProfileId, string? BrandName);

    /// <summary>
    /// A campaign/tap can only be attached when the creator actually had an
    /// assignment in it; a UGC order only when it was approved or paid. Anything
    /// else is rejected rather than silently stored as "verified".
    /// </summary>
    private async Task<Result<ResolvedLink>> ResolveLinkAsync(Guid creatorId, Guid? campaignId, Guid? ugcCollabId, CancellationToken ct)
    {
        if (campaignId.HasValue && ugcCollabId.HasValue)
            return Errors.Validation("Välj antingen en kampanj eller ett videouppdrag, inte båda.");

        if (campaignId.HasValue)
        {
            var a = await _assignments.Query()
                .Include(x => x.Campaign).ThenInclude(c => c.BrandProfile)
                .FirstOrDefaultAsync(x => x.CreatorProfileId == creatorId && x.CampaignId == campaignId.Value
                    && (x.Status == AssignmentStatus.Active || x.Status == AssignmentStatus.Completed), ct);
            if (a == null) return Errors.Validation("Kampanjen är inte ett av dina samarbeten på VYRLE.");
            return new ResolvedLink(a.CampaignId, null, a.Campaign.BrandProfileId, a.Campaign.BrandProfile.CompanyName);
        }

        if (ugcCollabId.HasValue)
        {
            var c = await _collabs.Query().FirstOrDefaultAsync(x => x.Id == ugcCollabId.Value && x.CreatorProfileId == creatorId
                && (x.Status == UgcCollabStatus.Approved || x.Status == UgcCollabStatus.Paid), ct);
            if (c == null) return Errors.Validation("Videouppdraget är inte ett godkänt uppdrag på VYRLE.");
            var brand = await _brands.Query().FirstOrDefaultAsync(b => b.Id == c.BrandProfileId, ct);
            return new ResolvedLink(null, c.Id, c.BrandProfileId, brand?.CompanyName);
        }

        return new ResolvedLink(null, null, null, null);
    }

    private static void ApplyLink(PortfolioItem item, ResolvedLink link, string? freeTextBrand)
    {
        item.CampaignId = link.CampaignId;
        item.UgcCollabId = link.UgcCollabId;
        item.BrandProfileId = link.BrandProfileId;
        // A verified link always carries the real company name; free text is only kept for unlinked items.
        item.BrandName = link.BrandProfileId.HasValue
            ? link.BrandName
            : (string.IsNullOrWhiteSpace(freeTextBrand) ? null : freeTextBrand.Trim());
    }

    /// <summary>Optional links still have to be plain http(s) — never javascript:, data: or a bare path.</summary>
    private static Error? ValidateOptionalUrl(string? url, string name)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        return Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)
               && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? null
            : Errors.Validation($"{name} must be a valid http(s) URL");
    }

    private static Error? Validate(string title, string mediaTypeRaw, string mediaUrl, out PortfolioMediaType mediaType)
    {
        mediaType = PortfolioMediaType.Link;
        if (string.IsNullOrWhiteSpace(title))
            return Errors.Validation("Title is required");
        if (title.Length > 200)
            return Errors.Validation("Title is too long (max 200)");
        if (!Enum.TryParse(mediaTypeRaw, ignoreCase: true, out mediaType))
            return Errors.Validation($"Invalid media type '{mediaTypeRaw}'");
        if (string.IsNullOrWhiteSpace(mediaUrl) ||
            !Uri.TryCreate(mediaUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return Errors.Validation("Media URL must be a valid http(s) URL");
        return null;
    }

    public static PortfolioItemDto MapToDto(PortfolioItem p) => MapToDto(p, null);

    /// <summary>
    /// Engagement on a portfolio card is shown only when the TikTok video is one
    /// of the creator's own verified campaign videos — never typed, never scraped.
    /// </summary>
    public static PortfolioItemDto MapToDto(PortfolioItem p, IReadOnlyDictionary<string, CreatorBadgeService.VerifiedPost>? verified)
    {
        CreatorBadgeService.VerifiedPost? match = null;
        if (verified != null && p.MediaType == PortfolioMediaType.TikTok)
        {
            var id = CreatorBadges.TikTokVideoId(p.MediaUrl);
            if (id != null) verified.TryGetValue(id, out match);
        }
        return new PortfolioItemDto(
            p.Id, p.Title, p.Description, p.MediaType.ToString(), p.MediaUrl,
            p.ThumbnailUrl, p.Category, p.BrandName,
            p.BrandVerified, p.BrandProfileId, p.CampaignId, p.UgcCollabId,
            p.SortOrder, p.IsFeatured, p.CreatedAt,
            match?.Views, match?.Likes, match?.MetricsUpdatedAt);
    }
}

// ────────────────────────────────────────────────────────────────
// CreatorDiscoveryService — brands search & view full creator profiles
// ────────────────────────────────────────────────────────────────
public class CreatorDiscoveryService : ICreatorDiscoveryService
{
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<PortfolioItem> _items;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<Review> _reviews;
    private readonly IRepository<PayoutRequest> _payouts;
    private readonly CreatorBadgeService _badges;

    public CreatorDiscoveryService(
        IRepository<CreatorProfile> creators,
        IRepository<PortfolioItem> items,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<Review> reviews,
        IRepository<PayoutRequest> payouts,
        CreatorBadgeService badges)
    {
        _creators = creators;
        _items = items;
        _assignments = assignments;
        _reviews = reviews;
        _payouts = payouts;
        _badges = badges;
    }

    /// <summary>Platform-verified performance per creator, from campaign/tap assignments that ran.</summary>
    private sealed record PerfStats(long Views, decimal Earned, int Completed, int Approved, int Decided, int VerifiedPosts, DateTime? MetricsUpdatedAt, DateTime? LastActive)
    {
        public static readonly PerfStats Empty = new(0, 0, 0, 0, 0, 0, null, null);
        public decimal Epm => Views > 0 ? Math.Round(Earned / Views * 1000m, 2) : 0m;
        public double ApprovalRate => Decided > 0 ? Math.Round(Approved * 100.0 / Decided, 1) : 0;
    }

    private async Task<Dictionary<Guid, PerfStats>> PerfStatsAsync(List<Guid> creatorIds, CancellationToken ct)
    {
        if (creatorIds.Count == 0) return new();
        var counted = _assignments.Query()
            .Where(a => creatorIds.Contains(a.CreatorProfileId) && !a.Campaign.IsDeleted
                && (a.Status == AssignmentStatus.Active || a.Status == AssignmentStatus.Completed));

        var totals = await counted
            .GroupBy(a => a.CreatorProfileId)
            .Select(g => new
            {
                Id = g.Key,
                Views = g.Sum(a => a.TotalVerifiedViews),
                Earned = g.Sum(a => a.CurrentPayoutAmount),
                Completed = g.Count(a => a.Status == AssignmentStatus.Completed),
                LastActive = g.Max(a => (DateTime?)(a.CompletedAt ?? a.AssignedAt)),
            })
            .ToDictionaryAsync(x => x.Id, ct);

        var decisions = await counted
            .SelectMany(a => a.Submissions.Select(s => new { a.CreatorProfileId, s.Status }))
            .Where(s => s.Status == SubmissionStatus.Approved || s.Status == SubmissionStatus.Rejected)
            .GroupBy(s => s.CreatorProfileId)
            .Select(g => new { Id = g.Key, Approved = g.Count(s => s.Status == SubmissionStatus.Approved), Decided = g.Count() })
            .ToDictionaryAsync(x => x.Id, ct);

        var posts = await counted
            .SelectMany(a => a.SocialPosts.Where(sp => sp.IsActive).Select(sp => new { a.CreatorProfileId, sp.VerificationStatus, sp.MetricsUpdatedAt }))
            .GroupBy(p => p.CreatorProfileId)
            .Select(g => new
            {
                Id = g.Key,
                Verified = g.Count(p => p.VerificationStatus == VerificationStatus.Verified),
                Updated = g.Max(p => p.MetricsUpdatedAt),
            })
            .ToDictionaryAsync(x => x.Id, ct);

        var result = new Dictionary<Guid, PerfStats>();
        foreach (var id in creatorIds)
        {
            totals.TryGetValue(id, out var t);
            decisions.TryGetValue(id, out var d);
            posts.TryGetValue(id, out var p);
            result[id] = new PerfStats(
                t?.Views ?? 0, t?.Earned ?? 0, t?.Completed ?? 0,
                d?.Approved ?? 0, d?.Decided ?? 0,
                p?.Verified ?? 0, p?.Updated,
                new[] { t?.LastActive, p?.Updated }.Max());
        }
        return result;
    }

    public async Task<Result<PagedResult<CreatorDiscoveryDto>>> SearchAsync(
        string? search, string? category, string? country, int? minFollowers,
        string? tag, bool? openToPrOffers, string? sort, int page, int pageSize, CancellationToken ct = default)
    {
        // Only approved creators with an OAuth-verified TikTok connection are
        // discoverable by brands (CreatorVisibility): a typed handle proves nothing.
        var query = _creators.Query()
            .Include(c => c.TikTokAccount)
            .Where(c => c.Status == CreatorStatus.Approved
                && c.TikTokAccount != null && c.TikTokAccount.IsActive
                && c.TikTokAccount.Scopes != TikTokAccountExtensions.ManualScope
                && c.TikTokAccount.AccessTokenEncrypted != "");

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(c => c.Category == category);
        if (!string.IsNullOrWhiteSpace(country))
            query = query.Where(c => c.Country == country);
        if (openToPrOffers == true)
            query = query.Where(c => c.OpenToPrOffers);
        // Follower filters only ever see OAuth-verified TikTok numbers; a typed handle has none.
        if (minFollowers is > 0)
            query = query.Where(c => c.TikTokAccount != null && c.TikTokAccount.IsActive
                && c.TikTokAccount.Scopes != TikTokAccountExtensions.ManualScope
                && c.TikTokAccount.AccessTokenEncrypted != ""
                && c.TikTokAccount.FollowerCount >= minFollowers);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.DisplayName.ToLower().Contains(s) ||
                (c.Bio != null && c.Bio.ToLower().Contains(s)) ||
                c.Category.ToLower().Contains(s));
        }

        // ProfileTags is a JSON-serialized column and can't be filtered in SQL,
        // so candidates are materialized and tag-filtered in memory. Fine at the
        // current scale; revisit with a tags table / array column if needed.
        var candidates = await query.ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(tag))
            candidates = candidates
                .Where(c => c.ProfileTags.Any(t => string.Equals(t, tag, StringComparison.OrdinalIgnoreCase)))
                .ToList();

        var candidateUserIds = candidates.Select(c => c.UserId).ToList();
        var ratings = await _reviews.Query()
            .Where(r => candidateUserIds.Contains(r.RevieweeId))
            .GroupBy(r => r.RevieweeId)
            .Select(g => new { UserId = g.Key, Avg = g.Average(r => (double)r.Stars), Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, ct);

        var perf = await PerfStatsAsync(candidates.Select(c => c.Id).ToList(), ct);
        PerfStats P(CreatorProfile c) => perf.GetValueOrDefault(c.Id, PerfStats.Empty);
        var topThreshold = await _badges.TopCreatorThresholdAsync(ct);

        // Ranking is by verified performance; followers are a tie-breaker, never the primary signal.
        candidates = (sort?.ToLower()) switch
        {
            "followers" => candidates.OrderByDescending(c => c.TikTokAccount.VerifiedFollowers()).ThenByDescending(c => P(c).Views).ToList(),
            "rating"    => candidates.OrderByDescending(c => ratings.TryGetValue(c.UserId, out var r) ? r.Avg : 0)
                                     .ThenByDescending(c => P(c).Views).ToList(),
            "recent"    => candidates.OrderByDescending(c => c.CreatedAt).ToList(),
            "epm"       => candidates.OrderByDescending(c => P(c).Epm).ThenByDescending(c => P(c).Views).ToList(),
            "approval"  => candidates.OrderByDescending(c => P(c).ApprovalRate).ThenByDescending(c => P(c).Decided).ToList(),
            "active"    => candidates.OrderByDescending(c => P(c).LastActive ?? DateTime.MinValue).ToList(),
            _           => candidates.OrderByDescending(c => P(c).Views).ThenByDescending(c => c.TikTokAccount.VerifiedFollowers()).ToList(),
        };

        var totalCount = candidates.Count;
        var pageItems = candidates.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        var pageIds = pageItems.Select(c => c.Id).ToList();

        var portfolioCounts = await _items.Query()
            .Where(p => pageIds.Contains(p.CreatorProfileId))
            .GroupBy(p => p.CreatorProfileId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

        var data = pageItems.Select(c =>
        {
            ratings.TryGetValue(c.UserId, out var r);
            var p = P(c);
            return new CreatorDiscoveryDto(
                c.Id, c.UserId, c.DisplayName, c.Bio, c.Category, c.Country, c.Language,
                c.AvatarUrl,
                c.TikTokAccount != null && c.TikTokAccount.IsActive, c.TikTokAccount.IsVerified(), c.TikTokAccount?.TikTokUsername,
                c.TikTokAccount.VerifiedFollowers(), c.TikTokAccount.FollowersSyncedAt(),
                c.InstagramUsername,
                c.ProfileTags?.ToList() ?? [],
                portfolioCounts.GetValueOrDefault(c.Id),
                r != null ? Math.Round(r.Avg, 1) : 0, r?.Count ?? 0,
                p.Completed,
                c.OpenToPrOffers,
                p.Views, p.Earned, p.Epm, p.Approved, p.Decided, p.ApprovalRate,
                p.MetricsUpdatedAt, p.LastActive,
                CreatorBadges.IsVerifiedCreator(c.TikTokAccount.IsVerified(), p.VerifiedPosts),
                CreatorBadges.IsTopCreator(p.Views, p.VerifiedPosts, topThreshold));
        }).ToList();

        return new PagedResult<CreatorDiscoveryDto>
        {
            Data = data, Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<CreatorPublicProfileDto>> GetPublicProfileAsync(Guid creatorProfileId, CancellationToken ct = default)
    {
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .Include(c => c.PortfolioItems)
            .FirstOrDefaultAsync(c => c.Id == creatorProfileId, ct);

        if (creator == null || !CreatorVisibility.IsVisibleToBrands(creator.Status, creator.TikTokAccount.IsVerified()))
            return Errors.NotFound("Creator", creatorProfileId);

        var reviews = await _reviews.Query()
            .Include(r => r.Reviewer)
            .Where(r => r.RevieweeId == creator.UserId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var avg = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Stars), 1) : 0;
        var recent = reviews.Take(10).Select(r => new ReviewDto(
            r.Id, r.AssignmentId, r.ReviewerId, r.ReviewerRole,
            $"{r.Reviewer.FirstName} {r.Reviewer.LastName}".Trim(), r.Stars, r.Comment, r.CreatedAt)).ToList();

        var verifiedPosts = await _badges.VerifiedPostsAsync(creator.Id, ct);
        var portfolio = creator.PortfolioItems
            .OrderByDescending(p => p.IsFeatured).ThenBy(p => p.SortOrder).ThenByDescending(p => p.CreatedAt)
            .Select(p => PortfolioService.MapToDto(p, verifiedPosts)).ToList();

        // Real, platform-verified engagement across all campaign videos —
        // never creator-reported numbers. Scope: every Verified post, all time.
        var engagement = await _assignments.Query()
            .Where(a => a.CreatorProfileId == creator.Id && !a.Campaign.IsDeleted)
            .SelectMany(a => a.SocialPosts)
            .Where(sp => sp.IsActive && sp.VerificationStatus == VerificationStatus.Verified)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Views = g.Sum(sp => (long?)sp.LatestViewCount) ?? 0,
                Likes = g.Sum(sp => (long?)sp.LatestLikeCount) ?? 0,
                Comments = g.Sum(sp => (long?)sp.LatestCommentCount) ?? 0,
                Shares = g.Sum(sp => (long?)sp.LatestShareCount) ?? 0,
                Count = g.Count(),
                Updated = g.Max(sp => sp.MetricsUpdatedAt),
            })
            .FirstOrDefaultAsync(ct);

        var tViews = engagement?.Views ?? 0;
        var tLikes = engagement?.Likes ?? 0;
        var tComments = engagement?.Comments ?? 0;
        var tShares = engagement?.Shares ?? 0;
        var engagementRate = tViews > 0
            ? Math.Round((tLikes + tComments + tShares) * 100.0 / tViews, 1)
            : 0;

        var perf = (await PerfStatsAsync([creator.Id], ct)).GetValueOrDefault(creator.Id, PerfStats.Empty);
        var paid = await _payouts.Query()
            .Where(p => p.CreatorProfileId == creator.Id && p.Status == PayoutStatus.Completed)
            .SumAsync(p => (decimal?)p.RequestedAmount, ct) ?? 0m;
        var topThreshold = await _badges.TopCreatorThresholdAsync(ct);

        return new CreatorPublicProfileDto(
            creator.Id, creator.UserId, creator.DisplayName, creator.Bio, creator.Category, creator.Country,
            creator.Language, creator.AvatarUrl, creator.Website,
            creator.TikTokAccount != null && creator.TikTokAccount.IsActive, creator.TikTokAccount.IsVerified(),
            creator.TikTokAccount?.TikTokUsername,
            creator.TikTokAccount.VerifiedFollowers(), creator.TikTokAccount.FollowersSyncedAt(),
            creator.InstagramUsername,
            creator.ProfileTags?.ToList() ?? [], creator.OpenToPrOffers,
            portfolio, avg, reviews.Count, recent, perf.Completed, creator.CreatedAt,
            tViews, tLikes, tComments, tShares, engagementRate,
            engagement?.Count ?? 0, engagement?.Updated,
            perf.Earned, perf.Epm, perf.Approved, perf.Decided, perf.ApprovalRate,
            CreatorLevels.For(paid).Name,
            creator.CoverUrl,
            CreatorBadges.IsVerifiedCreator(creator.TikTokAccount.IsVerified(), perf.VerifiedPosts),
            CreatorBadges.IsTopCreator(perf.Views, perf.VerifiedPosts, topThreshold));
    }
}
