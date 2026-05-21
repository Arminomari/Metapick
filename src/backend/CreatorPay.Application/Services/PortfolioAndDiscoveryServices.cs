using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
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
    private readonly IUnitOfWork _uow;

    public PortfolioService(IRepository<CreatorProfile> creators, IRepository<PortfolioItem> items, IUnitOfWork uow)
    {
        _creators = creators;
        _items = items;
        _uow = uow;
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

        return items.Select(MapToDto).ToList();
    }

    public async Task<Result<PortfolioItemDto>> AddItemAsync(Guid creatorUserId, CreatePortfolioItemRequest request, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator profile");

        var validation = Validate(request.Title, request.MediaType, request.MediaUrl, out var mediaType);
        if (validation != null) return validation;

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
            BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim(),
            Views = request.Views is >= 0 ? request.Views : null,
            Likes = request.Likes is >= 0 ? request.Likes : null,
            IsFeatured = request.IsFeatured,
            SortOrder = maxSort + 1,
        };

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

        var validation = Validate(request.Title, request.MediaType, request.MediaUrl, out var mediaType);
        if (validation != null) return validation;

        item.Title = request.Title.Trim();
        item.Description = request.Description?.Trim();
        item.MediaType = mediaType;
        item.MediaUrl = request.MediaUrl.Trim();
        item.ThumbnailUrl = string.IsNullOrWhiteSpace(request.ThumbnailUrl) ? null : request.ThumbnailUrl.Trim();
        item.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
        item.BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim();
        item.Views = request.Views is >= 0 ? request.Views : null;
        item.Likes = request.Likes is >= 0 ? request.Likes : null;
        item.SortOrder = request.SortOrder;
        item.IsFeatured = request.IsFeatured;

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

    internal static PortfolioItemDto MapToDto(PortfolioItem p) => new(
        p.Id, p.Title, p.Description, p.MediaType.ToString(), p.MediaUrl,
        p.ThumbnailUrl, p.Category, p.BrandName, p.Views, p.Likes, p.SortOrder, p.IsFeatured, p.CreatedAt);
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

    public CreatorDiscoveryService(
        IRepository<CreatorProfile> creators,
        IRepository<PortfolioItem> items,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<Review> reviews)
    {
        _creators = creators;
        _items = items;
        _assignments = assignments;
        _reviews = reviews;
    }

    public async Task<Result<PagedResult<CreatorDiscoveryDto>>> SearchAsync(
        string? search, string? category, string? country, int? minFollowers,
        string? tag, bool? openToPrOffers, string? sort, int page, int pageSize, CancellationToken ct = default)
    {
        // Only approved creators are discoverable by brands.
        var query = _creators.Query()
            .Include(c => c.TikTokAccount)
            .Where(c => c.Status == CreatorStatus.Approved);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(c => c.Category == category);
        if (!string.IsNullOrWhiteSpace(country))
            query = query.Where(c => c.Country == country);
        if (openToPrOffers == true)
            query = query.Where(c => c.OpenToPrOffers);
        if (minFollowers is > 0)
            query = query.Where(c => c.FollowerCount >= minFollowers ||
                (c.TikTokAccount != null && c.TikTokAccount.FollowerCount >= minFollowers) ||
                c.InstagramFollowerCount >= minFollowers);
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

        // Review aggregates for all candidates (one grouped query).
        var candidateUserIds = candidates.Select(c => c.UserId).ToList();
        var ratings = await _reviews.Query()
            .Where(r => candidateUserIds.Contains(r.RevieweeId))
            .GroupBy(r => r.RevieweeId)
            .Select(g => new { UserId = g.Key, Avg = g.Average(r => (double)r.Stars), Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, ct);

        // Sort
        Func<CreatorProfile, int> followers = c => Math.Max(
            Math.Max(c.FollowerCount, c.InstagramFollowerCount),
            c.TikTokAccount?.FollowerCount ?? 0);
        candidates = (sort?.ToLower()) switch
        {
            "rating"    => candidates.OrderByDescending(c => ratings.TryGetValue(c.UserId, out var r) ? r.Avg : 0)
                                     .ThenByDescending(followers).ToList(),
            "recent"    => candidates.OrderByDescending(c => c.CreatedAt).ToList(),
            "views"     => candidates.OrderByDescending(c => c.AverageViews ?? 0).ToList(),
            _           => candidates.OrderByDescending(followers).ToList(),
        };

        var totalCount = candidates.Count;
        var pageItems = candidates.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        var pageIds = pageItems.Select(c => c.Id).ToList();

        var portfolioCounts = await _items.Query()
            .Where(p => pageIds.Contains(p.CreatorProfileId))
            .GroupBy(p => p.CreatorProfileId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

        var completedCounts = await _assignments.Query()
            .Where(a => pageIds.Contains(a.CreatorProfileId) && a.Status == AssignmentStatus.Completed)
            .GroupBy(a => a.CreatorProfileId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

        var data = pageItems.Select(c =>
        {
            ratings.TryGetValue(c.UserId, out var r);
            return new CreatorDiscoveryDto(
                c.Id, c.UserId, c.DisplayName, c.Bio, c.Category, c.Country, c.Language,
                c.AvatarUrl, c.FollowerCount, c.AverageViews,
                c.TikTokAccount != null && c.TikTokAccount.IsActive, c.TikTokAccount?.TikTokUsername,
                c.TikTokAccount?.FollowerCount ?? 0,
                c.InstagramUsername, c.InstagramFollowerCount,
                c.ProfileTags?.ToList() ?? [],
                portfolioCounts.GetValueOrDefault(c.Id),
                r != null ? Math.Round(r.Avg, 1) : 0, r?.Count ?? 0,
                completedCounts.GetValueOrDefault(c.Id),
                c.OpenToPrOffers);
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

        if (creator == null || creator.Status != CreatorStatus.Approved)
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

        var completed = await _assignments.Query()
            .CountAsync(a => a.CreatorProfileId == creator.Id && a.Status == AssignmentStatus.Completed, ct);

        var portfolio = creator.PortfolioItems
            .OrderByDescending(p => p.IsFeatured).ThenBy(p => p.SortOrder).ThenByDescending(p => p.CreatedAt)
            .Select(PortfolioService.MapToDto).ToList();

        return new CreatorPublicProfileDto(
            creator.Id, creator.UserId, creator.DisplayName, creator.Bio, creator.Category, creator.Country,
            creator.Language, creator.AvatarUrl, creator.Website, creator.FollowerCount, creator.AverageViews,
            creator.TikTokAccount != null && creator.TikTokAccount.IsActive, creator.TikTokAccount?.TikTokUsername,
            creator.TikTokAccount?.FollowerCount ?? 0,
            creator.InstagramUsername, creator.InstagramFollowerCount,
            creator.ProfileTags?.ToList() ?? [], creator.OpenToPrOffers,
            portfolio, avg, reviews.Count, recent, completed, creator.CreatedAt);
    }
}
