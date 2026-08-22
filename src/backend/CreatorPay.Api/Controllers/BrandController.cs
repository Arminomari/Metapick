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

/// <summary>Community-inlägg på företagets profil.</summary>
[Route("api/brand/posts")]
[Authorize(Policy = "BrandOnly")]
public class BrandPostsController : BaseController
{
    private readonly ICampaignService _campaignsSvc;

    public BrandPostsController(ICampaignService campaigns) => _campaignsSvc = campaigns;

    /// <summary>Publicera ett inlägg — alla följare notifieras</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBrandPostRequest request, CancellationToken ct)
        => ToActionResult(await _campaignsSvc.CreateBrandPostAsync(GetUserId(), request, ct));

    /// <summary>Ta bort ett eget inlägg</summary>
    [HttpDelete("{postId:guid}")]
    public async Task<IActionResult> Delete(Guid postId, CancellationToken ct)
        => ToActionResult(await _campaignsSvc.DeleteBrandPostAsync(GetUserId(), postId, ct));
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
