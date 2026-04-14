using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CreatorPay.Api.Controllers;

[Route("api/campaigns")]
[Authorize]
public class CampaignController : BaseController
{
    private readonly ICampaignService _campaigns;

    public CampaignController(ICampaignService campaigns) => _campaigns = campaigns;

    /// <summary>Skapa ny kampanj (Brand)</summary>
    [HttpPost]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Create([FromBody] CreateCampaignRequest request, CancellationToken ct)
        => ToActionResult(await _campaigns.CreateCampaignAsync(GetUserId(), request, ct));

    /// <summary>Hämta kampanj-detaljer</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => ToActionResult(await _campaigns.GetCampaignAsync(id, ct));

    /// <summary>Uppdatera draft-kampanj (Brand)</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCampaignRequest request, CancellationToken ct)
        => ToActionResult(await _campaigns.UpdateCampaignAsync(id, GetUserId(), request, ct));

    /// <summary>Publicera kampanj (Brand)</summary>
    [HttpPost("{id:guid}/publish")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Publish(Guid id, CancellationToken ct)
        => ToActionResult(await _campaigns.PublishCampaignAsync(id, GetUserId(), ct));

    /// <summary>Pausa kampanj (Brand)</summary>
    [HttpPost("{id:guid}/pause")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct)
        => ToActionResult(await _campaigns.PauseCampaignAsync(id, GetUserId(), ct));

    /// <summary>Återuppta kampanj (Brand)</summary>
    [HttpPost("{id:guid}/resume")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct)
        => ToActionResult(await _campaigns.ResumeCampaignAsync(id, GetUserId(), ct));

    /// <summary>Brands egna kampanjer</summary>
    [HttpGet("mine")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> MyList(
        [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _campaigns.ListBrandCampaignsAsync(GetUserId(), status, page, pageSize, ct));
    }

    /// <summary>Bläddra bland aktiva kampanjer (Creator)</summary>
    [HttpGet("browse")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> Browse(
        [FromQuery] string? category, [FromQuery] string? country,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _campaigns.BrowseCampaignsAsync(category, country, page, pageSize, ct));
    }

    /// <summary>Bläddra bland aktiva kampanjer med cursor-baserad paginering (Creator)</summary>
    [HttpGet("browse/cursor")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> BrowseCursor(
        [FromQuery] string? category, [FromQuery] string? country,
        [FromQuery] string? cursor, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (_, pageSize) = ClampPagination(1, pageSize);
        return ToActionResult(await _campaigns.BrowseCampaignsWithCursorAsync(category, country, cursor, pageSize, ct));
    }

    /// <summary>Kampanjstatistik (Brand)</summary>
    [HttpGet("{id:guid}/analytics")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Analytics(Guid id, CancellationToken ct)
        => ToActionResult(await _campaigns.GetCampaignAnalyticsAsync(id, GetUserId(), ct));
}
