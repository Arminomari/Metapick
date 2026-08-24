using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

// ────────────────────────────────────────────────────────────────
// ReviewService
// ────────────────────────────────────────────────────────────────
public class ReviewService : IReviewService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<Review> _reviews;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<User> _users;

    public ReviewService(
        IUnitOfWork uow,
        IRepository<Review> reviews,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<User> users)
    {
        _uow = uow;
        _reviews = reviews;
        _assignments = assignments;
        _users = users;
    }

    public async Task<Result<ReviewDto>> SubmitReviewAsync(
        Guid assignmentId, Guid reviewerUserId, SubmitReviewRequest request, CancellationToken ct = default)
    {
        if (request.Stars < 1 || request.Stars > 5)
            return Result<ReviewDto>.Failure(new Error("VALIDATION_ERROR", "Stars must be between 1 and 5"));

        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile).ThenInclude(b => b.User)
            .Include(a => a.CreatorProfile).ThenInclude(c => c.User)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null)
            return Result<ReviewDto>.Failure(new Error("ASSIGNMENT_NOT_FOUND", "Assignment not found"));

        // Determine roles
        var brandUserId = assignment.Campaign.BrandProfile.UserId;
        var creatorUserId = assignment.CreatorProfile.UserId;

        bool isBrand = reviewerUserId == brandUserId;
        bool isCreator = reviewerUserId == creatorUserId;

        if (!isBrand && !isCreator)
            return Result<ReviewDto>.Failure(new Error("FORBIDDEN", "Not part of this assignment"));

        var reviewerRole = isBrand ? "Brand" : "Creator";
        var revieweeId = isBrand ? creatorUserId : brandUserId;

        // One review per reviewer per assignment
        var exists = await _reviews.Query()
            .AnyAsync(r => r.AssignmentId == assignmentId && r.ReviewerId == reviewerUserId, ct);
        if (exists)
            return Result<ReviewDto>.Failure(new Error("CONFLICT", "You have already reviewed this assignment"));

        var reviewer = await _users.Query().FirstOrDefaultAsync(u => u.Id == reviewerUserId, ct);
        if (reviewer == null)
            return Result<ReviewDto>.Failure(new Error("FORBIDDEN", "Reviewer not found"));

        var review = new Review
        {
            AssignmentId = assignmentId,
            ReviewerId = reviewerUserId,
            RevieweeId = revieweeId,
            ReviewerRole = reviewerRole,
            Stars = request.Stars,
            Comment = request.Comment,
        };

        _reviews.Add(review);
        await _uow.SaveChangesAsync(ct);

        var reviewerName = $"{reviewer.FirstName} {reviewer.LastName}".Trim();
        return Result<ReviewDto>.Success(MapToDto(review, reviewerName));
    }

    public async Task<Result<UserReviewSummaryDto>> GetReviewsForUserAsync(Guid targetUserId, CancellationToken ct = default)
    {
        var reviews = await _reviews.Query()
            .Include(r => r.Reviewer)
            .Where(r => r.RevieweeId == targetUserId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var dtos = reviews.Select(r => MapToDto(r, $"{r.Reviewer.FirstName} {r.Reviewer.LastName}".Trim())).ToList();
        var avg = reviews.Count > 0 ? reviews.Average(r => r.Stars) : 0.0;

        return Result<UserReviewSummaryDto>.Success(new UserReviewSummaryDto(
            Math.Round(avg, 1), reviews.Count, dtos));
    }

    public async Task<Result<ReviewDto?>> GetMyReviewForAssignmentAsync(Guid assignmentId, Guid reviewerUserId, CancellationToken ct = default)
    {
        var review = await _reviews.Query()
            .Include(r => r.Reviewer)
            .FirstOrDefaultAsync(r => r.AssignmentId == assignmentId && r.ReviewerId == reviewerUserId, ct);

        if (review == null) return Result<ReviewDto?>.Success(null);

        var name = $"{review.Reviewer.FirstName} {review.Reviewer.LastName}".Trim();
        return Result<ReviewDto?>.Success(MapToDto(review, name));
    }

    private static ReviewDto MapToDto(Review r, string reviewerName) => new(
        r.Id, r.AssignmentId, r.ReviewerId, r.ReviewerRole,
        reviewerName, r.Stars, r.Comment, r.CreatedAt);
}

// ────────────────────────────────────────────────────────────────
// ChatService
// ────────────────────────────────────────────────────────────────
public class ChatService : IChatService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<ChatMessage> _messages;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<User> _users;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly INotificationService _notifications;

    public ChatService(
        IUnitOfWork uow,
        IRepository<ChatMessage> messages,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<User> users,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        INotificationService notifications)
    {
        _brands = brands;
        _creators = creators;
        _notifications = notifications;
        _uow = uow;
        _messages = messages;
        _assignments = assignments;
        _users = users;
    }

    /// <summary>"d-{profileId}" = direct thread with that counterpart profile.</summary>
    private static bool IsDirect(string threadId, out Guid otherProfileId)
    {
        otherProfileId = Guid.Empty;
        return threadId.StartsWith("d-", StringComparison.OrdinalIgnoreCase)
            && Guid.TryParse(threadId[2..], out otherProfileId);
    }

    private sealed record DirectParties(Guid BrandProfileId, Guid CreatorProfileId, Guid BrandUserId, Guid CreatorUserId, bool CallerIsBrand);

    /// <summary>
    /// Resolves a direct thread from the caller's point of view. Brands reach
    /// creators; creators only ever see threads a brand already opened.
    /// </summary>
    private async Task<DirectParties?> ResolveDirectAsync(Guid otherProfileId, Guid userId, CancellationToken ct)
    {
        var callerBrand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId, ct);
        if (callerBrand != null)
        {
            var creator = await _creators.Query().FirstOrDefaultAsync(c => c.Id == otherProfileId, ct);
            if (creator == null) return null;
            return new DirectParties(callerBrand.Id, creator.Id, userId, creator.UserId, true);
        }

        var callerCreator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId, ct);
        if (callerCreator != null)
        {
            var brand = await _brands.Query().FirstOrDefaultAsync(b => b.Id == otherProfileId, ct);
            if (brand == null) return null;
            return new DirectParties(brand.Id, callerCreator.Id, brand.UserId, userId, false);
        }
        return null;
    }

    public async Task<Result<ChatMessageDto>> SendMessageAsync(
        string threadId, Guid senderUserId, SendMessageRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Body))
            return Result<ChatMessageDto>.Failure(new Error("VALIDATION_ERROR", "Message body cannot be empty"));

        if (IsDirect(threadId, out var otherId))
        {
            var parties = await ResolveDirectAsync(otherId, senderUserId, ct);
            if (parties == null)
                return Result<ChatMessageDto>.Failure(new Error("FORBIDDEN", "Konversationen finns inte"));

            var threadExists = await _messages.Query().AnyAsync(m =>
                m.BrandProfileId == parties.BrandProfileId && m.CreatorProfileId == parties.CreatorProfileId, ct);

            // Only a brand may open a direct thread — creators cannot cold-message.
            if (!parties.CallerIsBrand && !threadExists)
                return Result<ChatMessageDto>.Failure(new Error("FORBIDDEN",
                    "Du kan bara svara på meddelanden som ett företag har startat."));

            var directSender = await _users.Query().FirstOrDefaultAsync(u => u.Id == senderUserId, ct);
            if (directSender == null)
                return Result<ChatMessageDto>.Failure(new Error("FORBIDDEN", "Sender not found"));

            var direct = new ChatMessage
            {
                AssignmentId = null,
                BrandProfileId = parties.BrandProfileId,
                CreatorProfileId = parties.CreatorProfileId,
                SenderId = senderUserId,
                SenderRole = parties.CallerIsBrand ? "Brand" : "Creator",
                Body = request.Body.Trim(),
                IsRead = false,
            };
            _messages.Add(direct);
            await _uow.SaveChangesAsync(ct);

            if (!threadExists)
            {
                try
                {
                    var brandName = (await _brands.Query().FirstOrDefaultAsync(b => b.Id == parties.BrandProfileId, ct))?.CompanyName ?? "Ett företag";
                    await _notifications.SendAsync(parties.CreatorUserId, NotificationType.SystemMessage,
                        $"{brandName} har skickat dig ett meddelande på VYRLE.");
                }
                catch { /* the message itself is what matters */ }
            }

            var directName = $"{directSender.FirstName} {directSender.LastName}".Trim();
            return Result<ChatMessageDto>.Success(MapToDto(direct, directName));
        }

        if (!Guid.TryParse(threadId, out var assignmentId))
            return Result<ChatMessageDto>.Failure(new Error("VALIDATION_ERROR", "Ogiltig konversation"));

        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null)
            return Result<ChatMessageDto>.Failure(new Error("ASSIGNMENT_NOT_FOUND", "Assignment not found"));

        var brandUserId = assignment.Campaign.BrandProfile.UserId;
        var creatorUserId = assignment.CreatorProfile.UserId;

        bool isBrand = senderUserId == brandUserId;
        bool isCreator = senderUserId == creatorUserId;

        if (!isBrand && !isCreator)
            return Result<ChatMessageDto>.Failure(new Error("FORBIDDEN", "Not part of this assignment"));

        var senderRole = isBrand ? "Brand" : "Creator";

        var sender = await _users.Query().FirstOrDefaultAsync(u => u.Id == senderUserId, ct);
        if (sender == null)
            return Result<ChatMessageDto>.Failure(new Error("FORBIDDEN", "Sender not found"));

        var msg = new ChatMessage
        {
            AssignmentId = assignmentId,
            SenderId = senderUserId,
            SenderRole = senderRole,
            Body = request.Body.Trim(),
            IsRead = false,
        };

        _messages.Add(msg);
        await _uow.SaveChangesAsync(ct);

        var senderName = $"{sender.FirstName} {sender.LastName}".Trim();
        return Result<ChatMessageDto>.Success(MapToDto(msg, senderName));
    }

    public async Task<Result<List<ChatMessageDto>>> GetMessagesAsync(
        string threadId, Guid userId, CancellationToken ct = default)
    {
        if (IsDirect(threadId, out var otherId))
        {
            var parties = await ResolveDirectAsync(otherId, userId, ct);
            if (parties == null)
                return Result<List<ChatMessageDto>>.Failure(new Error("FORBIDDEN", "Konversationen finns inte"));

            var directMessages = await _messages.Query()
                .Include(m => m.Sender)
                .Where(m => m.BrandProfileId == parties.BrandProfileId && m.CreatorProfileId == parties.CreatorProfileId)
                .OrderBy(m => m.CreatedAt)
                .ToListAsync(ct);
            return Result<List<ChatMessageDto>>.Success(directMessages
                .Select(m => MapToDto(m, $"{m.Sender.FirstName} {m.Sender.LastName}".Trim())).ToList());
        }

        if (!Guid.TryParse(threadId, out var assignmentId))
            return Result<List<ChatMessageDto>>.Failure(new Error("VALIDATION_ERROR", "Ogiltig konversation"));

        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null)
            return Result<List<ChatMessageDto>>.Failure(new Error("ASSIGNMENT_NOT_FOUND", "Assignment not found"));

        var brandUserId = assignment.Campaign.BrandProfile.UserId;
        var creatorUserId = assignment.CreatorProfile.UserId;

        if (userId != brandUserId && userId != creatorUserId)
            return Result<List<ChatMessageDto>>.Failure(new Error("FORBIDDEN", "Not part of this assignment"));

        var messages = await _messages.Query()
            .Include(m => m.Sender)
            .Where(m => m.AssignmentId == assignmentId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);

        var dtos = messages.Select(m =>
            MapToDto(m, $"{m.Sender.FirstName} {m.Sender.LastName}".Trim())).ToList();

        return Result<List<ChatMessageDto>>.Success(dtos);
    }

    public async Task<Result<bool>> MarkReadAsync(string threadId, Guid userId, CancellationToken ct = default)
    {
        List<ChatMessage> unread;
        if (IsDirect(threadId, out var otherId))
        {
            var parties = await ResolveDirectAsync(otherId, userId, ct);
            if (parties == null) return Result<bool>.Success(true);
            unread = await _messages.Query()
                .Where(m => m.BrandProfileId == parties.BrandProfileId && m.CreatorProfileId == parties.CreatorProfileId
                    && m.SenderId != userId && !m.IsRead)
                .ToListAsync(ct);
        }
        else
        {
            if (!Guid.TryParse(threadId, out var assignmentId)) return Result<bool>.Success(true);
            unread = await _messages.Query()
                .Where(m => m.AssignmentId == assignmentId && m.SenderId != userId && !m.IsRead)
                .ToListAsync(ct);
        }

        foreach (var m in unread)
        {
            m.IsRead = true;
            m.ReadAt = DateTime.UtcNow;
        }

        await _uow.SaveChangesAsync(ct);
        return Result<bool>.Success(true);
    }

    public async Task<Result<int>> GetUnreadCountAsync(Guid userId, CancellationToken ct = default)
    {
        // Find all assignments where user is brand or creator
        var assignments = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .Where(a => a.Campaign.BrandProfile.UserId == userId || a.CreatorProfile.UserId == userId)
            .Select(a => a.Id)
            .ToListAsync(ct);

        var count = await _messages.Query()
            .CountAsync(m => m.AssignmentId != null && assignments.Contains(m.AssignmentId.Value)
                && m.SenderId != userId
                && !m.IsRead, ct);

        // Direct threads the user takes part in
        var myBrand = await _brands.Query().Where(b => b.UserId == userId).Select(b => (Guid?)b.Id).FirstOrDefaultAsync(ct);
        var myCreator = await _creators.Query().Where(c => c.UserId == userId).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(ct);
        if (myBrand != null || myCreator != null)
        {
            count += await _messages.Query().CountAsync(m => m.AssignmentId == null
                && ((myBrand != null && m.BrandProfileId == myBrand) || (myCreator != null && m.CreatorProfileId == myCreator))
                && m.SenderId != userId && !m.IsRead, ct);
        }

        return Result<int>.Success(count);
    }

    /// <summary>
    /// One row per assignment the user chats in, with the counterpart shown as
    /// a person/company (creator name+avatar for brands, company name+logo for
    /// creators — never the campaign name), plus preview and unread count.
    /// </summary>
    public async Task<Result<List<ChatConversationDto>>> GetConversationsAsync(Guid userId, CancellationToken ct = default)
    {
        var assignments = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .Where(a => a.Campaign.BrandProfile.UserId == userId || a.CreatorProfile.UserId == userId)
            .ToListAsync(ct);

        if (assignments.Count == 0)
            return new List<ChatConversationDto>();

        var ids = assignments.Select(a => a.Id).ToList();
        var aggregates = await _messages.Query()
            .Where(m => m.AssignmentId != null && ids.Contains(m.AssignmentId.Value))
            .GroupBy(m => m.AssignmentId)
            .Select(g => new
            {
                AssignmentId = g.Key,
                LastAt = g.Max(m => m.CreatedAt),
                Unread = g.Count(m => m.SenderId != userId && !m.IsRead)
            })
            .ToListAsync(ct);

        // Bodies of exactly the latest message per thread (CreatedAt ties are
        // practically impossible and harmless — same thread, same instant).
        var lastAts = aggregates.Select(x => x.LastAt).ToList();
        var lastBodies = await _messages.Query()
            .Where(m => m.AssignmentId != null && ids.Contains(m.AssignmentId.Value) && lastAts.Contains(m.CreatedAt))
            .Select(m => new { m.AssignmentId, m.CreatedAt, m.Body })
            .ToListAsync(ct);

        var aggByAssignment = aggregates.ToDictionary(x => x.AssignmentId);
        var conversations = assignments.Select(a =>
        {
            var isBrandSide = a.Campaign.BrandProfile.UserId == userId;
            aggByAssignment.TryGetValue(a.Id, out var agg);
            var lastBody = agg == null ? null
                : lastBodies.FirstOrDefault(b => b.AssignmentId == a.Id && b.CreatedAt == agg.LastAt)?.Body;
            return new ChatConversationDto(
                a.Id,
                isBrandSide
                    ? (a.CreatorProfile?.DisplayName ?? "Creator")
                    : (a.Campaign.BrandProfile?.CompanyName ?? "Varumärke"),
                isBrandSide ? a.CreatorProfile?.AvatarUrl : a.Campaign.BrandProfile?.LogoUrl,
                a.Campaign.Name,
                lastBody,
                agg?.LastAt,
                agg?.Unread ?? 0,
                isBrandSide ? a.CreatorProfile?.Id : a.Campaign.BrandProfile?.Id,
                isBrandSide ? "Creator" : "Brand",
                a.Id.ToString());
        })
        .ToList();

        conversations.AddRange(await GetDirectConversationsAsync(userId, ct));

        return conversations
            .OrderByDescending(c => c.LastMessageAt ?? DateTime.MinValue)
            .ThenBy(c => c.CounterpartName)
            .ToList();
    }

    /// <summary>Brand↔creator threads that live outside any assignment.</summary>
    private async Task<List<ChatConversationDto>> GetDirectConversationsAsync(Guid userId, CancellationToken ct)
    {
        var myBrandId = await _brands.Query().Where(b => b.UserId == userId).Select(b => (Guid?)b.Id).FirstOrDefaultAsync(ct);
        var myCreatorId = myBrandId != null ? null
            : await _creators.Query().Where(c => c.UserId == userId).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(ct);
        if (myBrandId == null && myCreatorId == null) return new List<ChatConversationDto>();

        var mine = await _messages.Query()
            .Where(m => m.AssignmentId == null
                && ((myBrandId != null && m.BrandProfileId == myBrandId)
                 || (myCreatorId != null && m.CreatorProfileId == myCreatorId)))
            .ToListAsync(ct);
        if (mine.Count == 0) return new List<ChatConversationDto>();

        var isBrandSide = myBrandId != null;
        var counterpartIds = mine
            .Select(m => isBrandSide ? m.CreatorProfileId : m.BrandProfileId)
            .Where(id => id != null).Select(id => id!.Value).Distinct().ToList();

        var creatorLookup = isBrandSide
            ? await _creators.Query().Where(c => counterpartIds.Contains(c.Id))
                .Select(c => new { c.Id, Name = c.DisplayName, Image = c.AvatarUrl }).ToListAsync(ct)
            : new List<dynamic>().Select(_ => new { Id = Guid.Empty, Name = "", Image = (string?)null }).ToList();
        var brandLookup = isBrandSide
            ? new List<dynamic>().Select(_ => new { Id = Guid.Empty, Name = "", Image = (string?)null }).ToList()
            : await _brands.Query().Where(b => counterpartIds.Contains(b.Id))
                .Select(b => new { b.Id, Name = b.CompanyName, Image = b.LogoUrl }).ToListAsync(ct);
        var lookup = (isBrandSide ? creatorLookup : brandLookup).ToDictionary(x => x.Id);

        return mine
            .GroupBy(m => isBrandSide ? m.CreatorProfileId!.Value : m.BrandProfileId!.Value)
            .Select(g =>
            {
                var last = g.OrderByDescending(m => m.CreatedAt).First();
                lookup.TryGetValue(g.Key, out var who);
                return new ChatConversationDto(
                    Guid.Empty,
                    who?.Name ?? (isBrandSide ? "Creator" : "Varumärke"),
                    who?.Image,
                    "Direktmeddelande",
                    last.Body,
                    last.CreatedAt,
                    g.Count(m => m.SenderId != userId && !m.IsRead),
                    g.Key,
                    isBrandSide ? "Creator" : "Brand",
                    "d-" + g.Key,
                    true);
            })
            .ToList();
    }

    private static ChatMessageDto MapToDto(ChatMessage m, string senderName) => new(
        m.Id, m.AssignmentId, m.SenderId, m.SenderRole,
        senderName, m.Body, m.IsRead, m.CreatedAt);
}
