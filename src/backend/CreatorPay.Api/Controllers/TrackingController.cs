using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CreatorPay.Api.Controllers;

[Route("api/tracking")]
[ApiController]
public class TrackingController : BaseController
{
    private readonly ITrackingLinkService _trackingLinks;

    public TrackingController(ITrackingLinkService trackingLinks)
    {
        _trackingLinks = trackingLinks;
    }

    [HttpPost("assignments/{assignmentId:guid}/links")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> CreateLink(Guid assignmentId, [FromBody] CreateTrackingLinkRequest request, CancellationToken ct)
        => ToActionResult(await _trackingLinks.CreateLinkAsync(assignmentId, GetUserId(), request, ct));

    [HttpGet("assignments/{assignmentId:guid}/links")]
    [Authorize]
    public async Task<IActionResult> GetAssignmentLinks(Guid assignmentId, CancellationToken ct)
        => ToActionResult(await _trackingLinks.GetAssignmentLinksAsync(assignmentId, GetUserId(), ct));

    [AllowAnonymous]
    [EnableRateLimiting("tracking")]
    [HttpGet("r/{code}")]
    public async Task<IActionResult> ResolveAndRedirect(string code, CancellationToken ct)
    {
        var context = new LinkClickContext(
            Request.Headers.Referer.ToString(),
            Request.Headers.UserAgent.ToString(),
            TrackingLinkService.HashIp(HttpContext.Connection.RemoteIpAddress?.ToString()));

        var result = await _trackingLinks.RegisterClickAsync(code, context, ct);
        if (!result.IsSuccess || result.Value == null)
            return ToActionResult(result);

        return Redirect(result.Value.TargetUrl);
    }
}
