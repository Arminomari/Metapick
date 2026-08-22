using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CreatorPay.Api.Controllers;

[Route("api/brand")]
[Authorize(Policy = "BrandOnly")]
public class BrandController : BaseController
{
    private readonly IBrandService _brands;

    public BrandController(IBrandService brands) => _brands = brands;

    /// <summary>Hämta brand-profil</summary>
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
        => ToActionResult(await _brands.GetProfileAsync(GetUserId()));

    /// <summary>Uppdatera brand-profil</summary>
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateBrandProfileRequest request)
        => ToActionResult(await _brands.UpdateProfileAsync(GetUserId(), request));
}

/// <summary>Offentliga företagsprofiler — nås av alla inloggade.</summary>
[Route("api/brands")]
[Authorize]
public class BrandPublicController : BaseController
{
    private readonly ICampaignService _campaigns;

    public BrandPublicController(ICampaignService campaigns) => _campaigns = campaigns;

    /// <summary>Företagets publika profil: följare, kampanjer, omdömen</summary>
    [HttpGet("{brandProfileId:guid}/public")]
    public async Task<IActionResult> GetPublicProfile(Guid brandProfileId, CancellationToken ct)
        => ToActionResult(await _campaigns.GetBrandPublicProfileAsync(brandProfileId, GetUserId(), ct));

    /// <summary>Följ företaget</summary>
    [HttpPost("{brandProfileId:guid}/follow")]
    public async Task<IActionResult> Follow(Guid brandProfileId, CancellationToken ct)
        => ToActionResult(await _campaigns.SetBrandFollowAsync(GetUserId(), brandProfileId, true, ct));

    /// <summary>Sluta följa företaget</summary>
    [HttpDelete("{brandProfileId:guid}/follow")]
    public async Task<IActionResult> Unfollow(Guid brandProfileId, CancellationToken ct)
        => ToActionResult(await _campaigns.SetBrandFollowAsync(GetUserId(), brandProfileId, false, ct));
}
