using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CreatorPay.Api.Controllers;

[Route("api/applications")]
[Authorize]
public class ApplicationController : BaseController
{
    private readonly IApplicationService _applications;

    public ApplicationController(IApplicationService applications) => _applications = applications;

    /// <summary>Ansök till kampanj (Creator)</summary>
    [HttpPost]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> Apply([FromBody] ApplyToCampaignRequest request, CancellationToken ct)
        => ToActionResult(await _applications.ApplyToCampaignAsync(GetUserId(), request, ct));

    /// <summary>Dra tillbaka ansökan (Creator)</summary>
    [HttpPost("{id:guid}/withdraw")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> Withdraw(Guid id, CancellationToken ct)
        => ToActionResult(await _applications.WithdrawApplicationAsync(id, GetUserId(), ct));

    /// <summary>Godkänn ansökan (Brand)</summary>
    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Approve(Guid id, [FromQuery] string? note, CancellationToken ct)
        => ToActionResult(await _applications.ApproveApplicationAsync(id, GetUserId(), note, ct));

    /// <summary>Avvisa ansökan (Brand)</summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectReasonRequest request, CancellationToken ct)
        => ToActionResult(await _applications.RejectApplicationAsync(id, GetUserId(), request.Reason, ct));

    /// <summary>Lista ansökningar för kampanj (Brand)</summary>
    [HttpGet("campaign/{campaignId:guid}")]
    [Authorize(Policy = "BrandOrAdmin")]
    public async Task<IActionResult> ListByCampaign(
        Guid campaignId, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _applications.GetCampaignApplicationsAsync(campaignId, GetUserId(), status, page, pageSize, ct));
    }

    /// <summary>Lista mina ansökningar (Creator)</summary>
    [HttpGet("mine")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> ListMine([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _applications.GetCreatorApplicationsAsync(GetUserId(), status, page, pageSize, ct));
    }
}

[Route("api/assignments")]
[Authorize]
public class AssignmentController : BaseController
{
    private readonly IAssignmentService _assignments;

    public AssignmentController(IAssignmentService assignments) => _assignments = assignments;

    /// <summary>Hämta assignment-detaljer</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => ToActionResult(await _assignments.GetAssignmentAsync(id, GetUserId(), ct));

    /// <summary>Mina tilldelningar (Creator)</summary>
    [HttpGet("mine")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> MyAssignments(
        [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _assignments.GetCreatorAssignmentsAsync(GetUserId(), status, page, pageSize, ct));
    }

    /// <summary>Skicka in video (Creator)</summary>
    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> SubmitVideo(Guid id, [FromBody] SubmitVideoRequest request, CancellationToken ct)
        => ToActionResult(await _assignments.SubmitVideoAsync(id, GetUserId(), request, ct));

    /// <summary>Hämta tracking-tag (Creator)</summary>
    [HttpGet("{id:guid}/tracking-tag")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> GetTrackingTag(Guid id, CancellationToken ct)
        => ToActionResult(await _assignments.GetTrackingTagAsync(id, GetUserId(), ct));

    /// <summary>Godkänn submission (Brand)</summary>
    [HttpPost("submissions/{id:guid}/approve")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> ApproveSubmission(Guid id, CancellationToken ct)
        => ToActionResult(await _assignments.ApproveSubmissionAsync(id, GetUserId(), ct));

    /// <summary>Neka submission (Brand)</summary>
    [HttpPost("submissions/{id:guid}/reject")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> RejectSubmission(Guid id, [FromBody] ReviewSubmissionRequest request, CancellationToken ct)
        => ToActionResult(await _assignments.RejectSubmissionAsync(id, GetUserId(), request.Reason, ct));
}
