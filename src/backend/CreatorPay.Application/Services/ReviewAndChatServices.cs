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

    public ChatService(
        IUnitOfWork uow,
        IRepository<ChatMessage> messages,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<User> users)
    {
        _uow = uow;
        _messages = messages;
        _assignments = assignments;
        _users = users;
    }

    public async Task<Result<ChatMessageDto>> SendMessageAsync(
        Guid assignmentId, Guid senderUserId, SendMessageRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Body))
            return Result<ChatMessageDto>.Failure(new Error("VALIDATION_ERROR", "Message body cannot be empty"));

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
        Guid assignmentId, Guid userId, CancellationToken ct = default)
    {
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

    public async Task<Result<bool>> MarkReadAsync(Guid assignmentId, Guid userId, CancellationToken ct = default)
    {
        var unread = await _messages.Query()
            .Where(m => m.AssignmentId == assignmentId && m.SenderId != userId && !m.IsRead)
            .ToListAsync(ct);

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
            .CountAsync(m => assignments.Contains(m.AssignmentId)
                && m.SenderId != userId
                && !m.IsRead, ct);

        return Result<int>.Success(count);
    }

    private static ChatMessageDto MapToDto(ChatMessage m, string senderName) => new(
        m.Id, m.AssignmentId, m.SenderId, m.SenderRole,
        senderName, m.Body, m.IsRead, m.CreatedAt);
}
