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

    /// <summary>Creatorns flöde: senaste inläggen från företag hen följer</summary>
    [HttpGet("feed")]
    public async Task<IActionResult> Feed(CancellationToken ct)
        => ToActionResult(await _campaigns.GetFollowedFeedAsync(GetUserId(), ct));

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

/// <summary>Kranen — varumärkets stående månadsbudget.</summary>
[Route("api/brand/tap")]
[Authorize(Policy = "BrandOnly")]
public class BrandTapController : BaseController
{
    private readonly ITapService _taps;
    public BrandTapController(ITapService taps) => _taps = taps;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
        => ToActionResult(await _taps.GetBrandTapAsync(GetUserId(), ct));

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertTapRequest request, CancellationToken ct)
        => ToActionResult(await _taps.UpsertTapAsync(GetUserId(), request, ct));

    [HttpPost("status")]
    public async Task<IActionResult> SetStatus([FromQuery] bool active, CancellationToken ct)
        => ToActionResult(await _taps.SetTapStatusAsync(GetUserId(), active, ct));
}

/// <summary>Varumärkets creator-community — medlemskap = rätten att hämta ur kranen.</summary>
[Route("api/brand/community")]
[Authorize(Policy = "BrandOnly")]
public class BrandCommunityController : BaseController
{
    private readonly ICommunityService _community;
    public BrandCommunityController(ICommunityService community) => _community = community;

    [HttpGet("members")]
    public async Task<IActionResult> Members(CancellationToken ct)
        => ToActionResult(await _community.GetMembersAsync(GetUserId(), ct));

    [HttpPost("invite")]
    public async Task<IActionResult> Invite([FromBody] InviteMemberRequest request, CancellationToken ct)
        => ToActionResult(await _community.InviteAsync(GetUserId(), request.CreatorProfileId, ct));

    /// <summary>Bjud in flera creators på en gång</summary>
    [HttpPost("invite-many")]
    public async Task<IActionResult> InviteMany([FromBody] InviteManyRequest request, CancellationToken ct)
        => ToActionResult(await _community.InviteManyAsync(GetUserId(), request.CreatorProfileIds, ct));

    /// <summary>Godkänn eller neka en ansökan till communityn</summary>
    [HttpPost("requests/{creatorProfileId:guid}")]
    public async Task<IActionResult> RespondToRequest(Guid creatorProfileId, [FromQuery] bool approve, CancellationToken ct)
        => ToActionResult(await _community.RespondToRequestAsync(GetUserId(), creatorProfileId, approve, ct));

    [HttpDelete("members/{creatorProfileId:guid}")]
    public async Task<IActionResult> Remove(Guid creatorProfileId, CancellationToken ct)
        => ToActionResult(await _community.RemoveAsync(GetUserId(), creatorProfileId, ct));
}

/// <summary>Creatorns kranar och communities.</summary>
[Route("api/creator")]
[Authorize(Policy = "CreatorOnly")]
public class CreatorTapController : BaseController
{
    private readonly ITapService _taps;
    private readonly ICommunityService _community;
    public CreatorTapController(ITapService taps, ICommunityService community) { _taps = taps; _community = community; }

    [HttpGet("taps")]
    public async Task<IActionResult> Taps(CancellationToken ct)
        => ToActionResult(await _taps.GetCreatorTapsAsync(GetUserId(), ct));

    [HttpGet("communities")]
    public async Task<IActionResult> Communities(CancellationToken ct)
        => ToActionResult(await _community.GetMyCommunitiesAsync(GetUserId(), ct));

    /// <summary>Ansök om att gå med i ett företags community</summary>
    [HttpPost("communities/{brandProfileId:guid}/request")]
    public async Task<IActionResult> RequestMembership(Guid brandProfileId, CancellationToken ct)
        => ToActionResult(await _community.RequestMembershipAsync(GetUserId(), brandProfileId, ct));

    [HttpDelete("communities/{brandProfileId:guid}")]
    public async Task<IActionResult> Leave(Guid brandProfileId, CancellationToken ct)
        => ToActionResult(await _community.LeaveAsync(GetUserId(), brandProfileId, ct));
}
