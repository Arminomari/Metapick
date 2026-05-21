using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

/// <summary>
/// PR Hub: brands/restaurants send direct PR offers to creators, creators
/// accept/decline, and brands track everything they've sent (counts, status,
/// category breakdown). The inverse of the campaign-application flow.
/// </summary>
public class PrOfferService : IPrOfferService
{
    private readonly IRepository<PrOffer> _offers;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<Campaign> _campaigns;
    private readonly INotificationService _notifications;
    private readonly IAuditService _audit;
    private readonly IUnitOfWork _uow;

    public PrOfferService(
        IRepository<PrOffer> offers,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        IRepository<Campaign> campaigns,
        INotificationService notifications,
        IAuditService audit,
        IUnitOfWork uow)
    {
        _offers = offers;
        _brands = brands;
        _creators = creators;
        _campaigns = campaigns;
        _notifications = notifications;
        _audit = audit;
        _uow = uow;
    }

    public async Task<Result<PrOfferDto>> CreateAsync(Guid brandUserId, CreatePrOfferRequest request, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand profile");
        if (brand.Status != BrandStatus.Approved)
            return Errors.Forbidden("Your brand account must be approved before sending PR offers");

        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200)
            return Errors.Validation("Title is required (max 200 characters)");
        if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Length > 4000)
            return Errors.Validation("Message is required (max 4000 characters)");
        if (string.IsNullOrWhiteSpace(request.Category))
            return Errors.Validation("Category is required");
        if (!Enum.TryParse<PrOfferType>(request.OfferType, ignoreCase: true, out var offerType))
            return Errors.Validation($"Invalid offer type '{request.OfferType}'");

        var needsCash = offerType is PrOfferType.Paid or PrOfferType.Hybrid;
        if (needsCash && (request.CompensationAmount is null or <= 0))
            return Errors.Validation("Paid offers require a compensation amount greater than 0");
        if (request.CompensationAmount is < 0 || request.ProductValue is < 0)
            return Errors.Validation("Amounts cannot be negative");

        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.Id == request.CreatorProfileId, ct);
        if (creator == null) return Errors.NotFound("Creator", request.CreatorProfileId);
        if (creator.Status != CreatorStatus.Approved)
            return Errors.Validation("This creator is not available for PR offers");
        if (!creator.OpenToPrOffers)
            return Errors.Validation("This creator is not currently accepting PR offers");

        if (request.CampaignId.HasValue)
        {
            var owns = await _campaigns.Query()
                .AnyAsync(c => c.Id == request.CampaignId.Value && c.BrandProfileId == brand.Id, ct);
            if (!owns) return Errors.Validation("Referenced campaign does not belong to your brand");
        }

        // Anti-spam: don't allow a second pending offer to the same creator from the same brand.
        var hasPending = await _offers.Query().AnyAsync(o =>
            o.BrandProfileId == brand.Id && o.CreatorProfileId == creator.Id &&
            (o.Status == PrOfferStatus.Sent || o.Status == PrOfferStatus.Viewed), ct);
        if (hasPending)
            return Errors.Conflict("You already have a pending PR offer to this creator");

        var offer = new PrOffer
        {
            BrandProfileId = brand.Id,
            CreatorProfileId = creator.Id,
            CampaignId = request.CampaignId,
            Title = request.Title.Trim(),
            Message = request.Message.Trim(),
            OfferType = offerType,
            Category = request.Category.Trim(),
            CompensationAmount = request.CompensationAmount,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "SEK" : request.Currency.Trim().ToUpper(),
            ProductDescription = string.IsNullOrWhiteSpace(request.ProductDescription) ? null : request.ProductDescription.Trim(),
            ProductValue = request.ProductValue,
            Deadline = request.Deadline,
            Status = PrOfferStatus.Sent,
        };

        _offers.Add(offer);
        await _uow.SaveChangesAsync(ct);

        await _notifications.SendAsync(creator.UserId, NotificationType.PrOfferReceived,
            $"{brand.CompanyName} skickade ett PR-erbjudande: {offer.Title}", offer.Id);
        await _audit.LogAsync(brandUserId, "PrOffer.Create", "PrOffer", offer.Id);

        return await LoadDtoAsync(offer.Id, ct);
    }

    public async Task<Result<PrOfferDto>> RespondAsync(Guid offerId, Guid creatorUserId, RespondPrOfferRequest request, CancellationToken ct = default)
    {
        var offer = await _offers.Query()
            .Include(o => o.BrandProfile)
            .Include(o => o.CreatorProfile)
            .FirstOrDefaultAsync(o => o.Id == offerId, ct);
        if (offer == null) return Errors.NotFound("PR offer", offerId);
        if (offer.CreatorProfile.UserId != creatorUserId) return Errors.Forbidden("Not your PR offer");

        if (offer.Status is not (PrOfferStatus.Sent or PrOfferStatus.Viewed))
            return Errors.Validation($"This offer can no longer be responded to (status: {offer.Status})");

        offer.Status = request.Accept ? PrOfferStatus.Accepted : PrOfferStatus.Declined;
        offer.ResponseMessage = string.IsNullOrWhiteSpace(request.ResponseMessage) ? null : request.ResponseMessage.Trim();
        offer.RespondedAt = DateTime.UtcNow;
        await _uow.SaveChangesAsync(ct);

        var type = request.Accept ? NotificationType.PrOfferAccepted : NotificationType.PrOfferDeclined;
        var verb = request.Accept ? "tackade ja till" : "tackade nej till";
        await _notifications.SendAsync(offer.BrandProfile.UserId, type,
            $"{offer.CreatorProfile.DisplayName} {verb} ditt PR-erbjudande: {offer.Title}", offer.Id);
        await _audit.LogAsync(creatorUserId, request.Accept ? "PrOffer.Accept" : "PrOffer.Decline", "PrOffer", offer.Id);

        return await LoadDtoAsync(offer.Id, ct);
    }

    public async Task<Result<PrOfferDto>> WithdrawAsync(Guid offerId, Guid brandUserId, CancellationToken ct = default)
    {
        var offer = await _offers.Query()
            .Include(o => o.BrandProfile)
            .FirstOrDefaultAsync(o => o.Id == offerId, ct);
        if (offer == null) return Errors.NotFound("PR offer", offerId);
        if (offer.BrandProfile.UserId != brandUserId) return Errors.Forbidden("Not your PR offer");
        if (offer.Status is not (PrOfferStatus.Sent or PrOfferStatus.Viewed))
            return Errors.Validation($"Only pending offers can be withdrawn (status: {offer.Status})");

        offer.Status = PrOfferStatus.Withdrawn;
        await _uow.SaveChangesAsync(ct);
        return await LoadDtoAsync(offer.Id, ct);
    }

    public async Task<Result<PrOfferDto>> MarkViewedAsync(Guid offerId, Guid creatorUserId, CancellationToken ct = default)
    {
        var offer = await _offers.Query()
            .Include(o => o.CreatorProfile)
            .FirstOrDefaultAsync(o => o.Id == offerId, ct);
        if (offer == null) return Errors.NotFound("PR offer", offerId);
        if (offer.CreatorProfile.UserId != creatorUserId) return Errors.Forbidden("Not your PR offer");

        if (offer.Status == PrOfferStatus.Sent)
        {
            offer.Status = PrOfferStatus.Viewed;
            offer.ViewedAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(ct);
        }
        return await LoadDtoAsync(offer.Id, ct);
    }

    public async Task<Result<PrOfferDto>> GetAsync(Guid offerId, Guid userId, CancellationToken ct = default)
    {
        var offer = await _offers.Query()
            .Include(o => o.BrandProfile)
            .Include(o => o.CreatorProfile)
            .Include(o => o.Campaign)
            .FirstOrDefaultAsync(o => o.Id == offerId, ct);
        if (offer == null) return Errors.NotFound("PR offer", offerId);
        if (offer.BrandProfile.UserId != userId && offer.CreatorProfile.UserId != userId)
            return Errors.Forbidden("Not part of this PR offer");
        return MapToDto(offer);
    }

    public async Task<Result<PagedResult<PrOfferDto>>> GetSentAsync(Guid brandUserId, string? status, string? category, int page, int pageSize, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand profile");

        var query = _offers.Query()
            .Include(o => o.BrandProfile)
            .Include(o => o.CreatorProfile)
            .Include(o => o.Campaign)
            .Where(o => o.BrandProfileId == brand.Id);

        if (Enum.TryParse<PrOfferStatus>(status, ignoreCase: true, out var st))
            query = query.Where(o => o.Status == st);
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(o => o.Category == category);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return new PagedResult<PrOfferDto>
        {
            Data = items.Select(MapToDto).ToList(), Page = page, PageSize = pageSize, TotalCount = total
        };
    }

    public async Task<Result<PagedResult<PrOfferDto>>> GetReceivedAsync(Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator profile");

        var query = _offers.Query()
            .Include(o => o.BrandProfile)
            .Include(o => o.CreatorProfile)
            .Include(o => o.Campaign)
            .Where(o => o.CreatorProfileId == creator.Id && o.Status != PrOfferStatus.Withdrawn);

        if (Enum.TryParse<PrOfferStatus>(status, ignoreCase: true, out var st))
            query = query.Where(o => o.Status == st);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return new PagedResult<PrOfferDto>
        {
            Data = items.Select(MapToDto).ToList(), Page = page, PageSize = pageSize, TotalCount = total
        };
    }

    public async Task<Result<PrOfferStatsDto>> GetBrandStatsAsync(Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand profile");

        var offers = await _offers.Query()
            .Where(o => o.BrandProfileId == brand.Id)
            .Select(o => new { o.Status, o.Category })
            .ToListAsync(ct);

        var byCategory = offers
            .GroupBy(o => o.Category)
            .Select(g => new PrCategoryCountDto(g.Key, g.Count()))
            .OrderByDescending(c => c.Count)
            .ToList();

        return new PrOfferStatsDto(
            offers.Count,
            offers.Count(o => o.Status == PrOfferStatus.Sent),
            offers.Count(o => o.Status == PrOfferStatus.Viewed),
            offers.Count(o => o.Status is PrOfferStatus.Accepted or PrOfferStatus.Completed),
            offers.Count(o => o.Status == PrOfferStatus.Declined),
            byCategory);
    }

    public async Task<Result<int>> GetCreatorUnreadCountAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Result<int>.Success(0);
        var count = await _offers.Query()
            .CountAsync(o => o.CreatorProfileId == creator.Id && o.Status == PrOfferStatus.Sent, ct);
        return Result<int>.Success(count);
    }

    private async Task<Result<PrOfferDto>> LoadDtoAsync(Guid offerId, CancellationToken ct)
    {
        var offer = await _offers.Query()
            .Include(o => o.BrandProfile)
            .Include(o => o.CreatorProfile)
            .Include(o => o.Campaign)
            .FirstOrDefaultAsync(o => o.Id == offerId, ct);
        if (offer == null) return Errors.NotFound("PR offer", offerId);
        return MapToDto(offer);
    }

    private static PrOfferDto MapToDto(PrOffer o) => new(
        o.Id, o.BrandProfileId, o.BrandProfile?.CompanyName ?? "", o.BrandProfile?.LogoUrl,
        o.CreatorProfileId, o.CreatorProfile?.DisplayName ?? "", o.CreatorProfile?.AvatarUrl,
        o.CampaignId, o.Campaign?.Name,
        o.Title, o.Message, o.OfferType.ToString(), o.Category,
        o.CompensationAmount, o.Currency, o.ProductDescription, o.ProductValue,
        o.Deadline, o.Status.ToString(), o.ResponseMessage,
        o.CreatedAssignmentId, o.ViewedAt, o.RespondedAt, o.CreatedAt);
}
