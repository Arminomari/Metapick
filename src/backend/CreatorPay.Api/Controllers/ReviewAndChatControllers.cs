using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CreatorPay.Api.Controllers;

[Route("api/reviews")]
[Authorize]
public class ReviewController : BaseController
{
    private readonly IReviewService _reviews;
    public ReviewController(IReviewService reviews) => _reviews = reviews;

    /// <summary>Lämna ett omdöme för ett uppdrag (Brand eller Creator)</summary>
    [HttpPost("assignments/{assignmentId:guid}")]
    public async Task<IActionResult> Submit(Guid assignmentId, [FromBody] SubmitReviewRequest request, CancellationToken ct)
        => ToActionResult(await _reviews.SubmitReviewAsync(assignmentId, GetUserId(), request, ct));

    /// <summary>Hämta alla omdömen om en användare</summary>
    [HttpGet("users/{userId:guid}")]
    public async Task<IActionResult> GetForUser(Guid userId, CancellationToken ct)
        => ToActionResult(await _reviews.GetReviewsForUserAsync(userId, ct));

    /// <summary>Hämta mitt eget omdöme för ett uppdrag (om det finns)</summary>
    [HttpGet("assignments/{assignmentId:guid}/mine")]
    public async Task<IActionResult> GetMine(Guid assignmentId, CancellationToken ct)
        => ToActionResult(await _reviews.GetMyReviewForAssignmentAsync(assignmentId, GetUserId(), ct));
}

[Route("api/chat")]
[Authorize]
public class ChatController : BaseController
{
    private readonly IChatService _chat;
    public ChatController(IChatService chat) => _chat = chat;

    /// <summary>Skicka ett meddelande i en uppdragstråd</summary>
    [HttpPost("assignments/{assignmentId:guid}/messages")]
    public async Task<IActionResult> Send(Guid assignmentId, [FromBody] SendMessageRequest request, CancellationToken ct)
        => ToActionResult(await _chat.SendMessageAsync(assignmentId, GetUserId(), request, ct));

    /// <summary>Hämta alla meddelanden för ett uppdrag</summary>
    [HttpGet("assignments/{assignmentId:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid assignmentId, CancellationToken ct)
        => ToActionResult(await _chat.GetMessagesAsync(assignmentId, GetUserId(), ct));

    /// <summary>Markera alla meddelanden i ett uppdrag som lästa</summary>
    [HttpPost("assignments/{assignmentId:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid assignmentId, CancellationToken ct)
        => ToActionResult(await _chat.MarkReadAsync(assignmentId, GetUserId(), ct));

    /// <summary>Antal olästa meddelanden totalt för inloggad användare</summary>
    [HttpGet("unread")]
    public async Task<IActionResult> GetUnreadCount(CancellationToken ct)
        => ToActionResult(await _chat.GetUnreadCountAsync(GetUserId(), ct));
}
