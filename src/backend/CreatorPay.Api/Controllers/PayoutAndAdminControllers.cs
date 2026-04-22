using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CreatorPay.Api.Controllers;

[Route("api/payouts")]
[Authorize]
public class PayoutController : BaseController
{
    private readonly IPayoutService _payouts;

    public PayoutController(IPayoutService payouts) => _payouts = payouts;

    /// <summary>Begär utbetalning (Creator)</summary>
    [HttpPost("request")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> RequestPayout([FromBody] RequestPayoutRequest request, CancellationToken ct)
        => ToActionResult(await _payouts.RequestPayoutAsync(GetUserId(), request, ct));

    /// <summary>Mina utbetalningar (Creator)</summary>
    [HttpGet("mine")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> MyPayouts(
        [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _payouts.GetCreatorPayoutsAsync(GetUserId(), status, page, pageSize, ct));
    }

    /// <summary>Senaste beräkning för tilldelning</summary>
    [HttpGet("calculation/{assignmentId:guid}")]
    public async Task<IActionResult> GetCalculation(Guid assignmentId, CancellationToken ct)
        => ToActionResult(await _payouts.GetLatestCalculationAsync(assignmentId, GetUserId(), ct));

    /// <summary>Godkänn utbetalning (Admin)</summary>
    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
        => ToActionResult(await _payouts.ApprovePayoutAsync(id, GetUserId(), ct));

    /// <summary>Markera manuell utbetalning som skickad (Brand)</summary>
    [HttpPost("assignments/{assignmentId:guid}/manual")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> MarkManualPayout(Guid assignmentId, CancellationToken ct)
        => ToActionResult(await _payouts.MarkManualPayoutSentAsync(assignmentId, GetUserId(), ct));

    /// <summary>Avvisa utbetalning (Admin)</summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectReasonRequest request, CancellationToken ct)
        => ToActionResult(await _payouts.RejectPayoutAsync(id, GetUserId(), request.Reason, ct));

    /// <summary>Alla utbetalningar (Admin)</summary>
    [HttpGet("all")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> All(
        [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _payouts.GetAllPayoutsAsync(status, page, pageSize, ct));
    }
}

[Route("api/fraud")]
[Authorize(Policy = "AdminOnly")]
public class FraudController : BaseController
{
    private readonly IFraudService _fraud;

    public FraudController(IFraudService fraud) => _fraud = fraud;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status, [FromQuery] string? severity,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _fraud.GetFraudFlagsAsync(status, severity, page, pageSize));
    }

    [HttpPost("{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveFraudFlagRequest request)
        => ToActionResult(await _fraud.ResolveFraudFlagAsync(id, GetUserId(), request));
}

[Route("api/notifications")]
[Authorize]
public class NotificationController : BaseController
{
    private readonly INotificationService _notifications;

    public NotificationController(INotificationService notifications) => _notifications = notifications;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] bool? unreadOnly, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _notifications.GetNotificationsAsync(GetUserId(), unreadOnly, page, pageSize));
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
        => ToActionResult(await _notifications.MarkAsReadAsync(id, GetUserId()));

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
        => ToActionResult(await _notifications.MarkAllReadAsync(GetUserId()));
}

[Route("api/admin/users")]
[Authorize(Policy = "AdminOnly")]
public class AdminUserController : BaseController
{
    private readonly IAdminUserService _adminUsers;

    public AdminUserController(IAdminUserService adminUsers) => _adminUsers = adminUsers;

    [HttpGet]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _adminUsers.GetUsersAsync(status, page, pageSize));
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> ApproveUser(Guid id)
        => ToActionResult(await _adminUsers.ApproveUserAsync(id, GetUserId()));

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> RejectUser(Guid id, [FromBody] RejectReasonRequest request)
        => ToActionResult(await _adminUsers.RejectUserAsync(id, GetUserId(), request.Reason));

    /// <summary>Trigga kampanjsynk manuellt (Admin)</summary>
    [HttpPost("/api/admin/trigger-sync")]
    public IActionResult TriggerSync()
    {
        BackgroundJob.Enqueue<CreatorPay.Application.Interfaces.ICampaignSyncTrigger>(x => x.ExecuteAsync());
        return Ok(new { message = "Synk-jobb startat" });
    }
}

[Route("api/admin/campaigns")]
[Authorize(Policy = "AdminOnly")]
public class AdminCampaignController : BaseController
{
    private readonly ICampaignService _campaigns;

    public AdminCampaignController(ICampaignService campaigns) => _campaigns = campaigns;

    /// <summary>Hämta kampanjer som väntar på granskning</summary>
    [HttpGet("pending")]
    public async Task<IActionResult> GetPending(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _campaigns.ListPendingReviewCampaignsAsync(page, pageSize, ct));
    }

    /// <summary>Godkänn kampanj</summary>
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
        => ToActionResult(await _campaigns.ApproveCampaignAsync(id, GetUserId(), ct));

    /// <summary>Neka kampanj</summary>
    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectReasonRequest request, CancellationToken ct)
        => ToActionResult(await _campaigns.RejectCampaignAsync(id, GetUserId(), request.Reason, ct));
}

[Route("api/audit")]
[Authorize(Policy = "AdminOnly")]
public class AuditController : BaseController
{
    private readonly IAuditService _audit;

    public AuditController(IAuditService audit) => _audit = audit;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? entityType, [FromQuery] Guid? entityId, [FromQuery] Guid? userId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        => ToActionResult(await _audit.GetAuditLogsAsync(entityType, entityId, userId, page, pageSize));
}
