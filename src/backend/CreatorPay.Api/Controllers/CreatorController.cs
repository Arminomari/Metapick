using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CreatorPay.Api.Controllers;

[Route("api/creator")]
[Authorize]
public class CreatorController : BaseController
{
    private readonly ICreatorService _creators;
    private readonly ITikTokConnectService _tiktok;

    public CreatorController(ICreatorService creators, ITikTokConnectService tiktok)
    {
        _creators = creators;
        _tiktok = tiktok;
    }

    /// <summary>Hämta min creator-profil</summary>
    [HttpGet("profile")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> GetProfile()
        => ToActionResult(await _creators.GetProfileAsync(GetUserId()));

    /// <summary>Uppdatera min creator-profil</summary>
    [HttpPut("profile")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateCreatorProfileRequest request)
        => ToActionResult(await _creators.UpdateProfileAsync(GetUserId(), request));

    /// <summary>Get TikTok OAuth authorization URL</summary>
    [HttpGet("tiktok/auth-url")]
    [Authorize(Policy = "CreatorOnly")]
    public IActionResult GetTikTokAuthUrl()
    {
        var url = _tiktok.GetAuthorizationUrl(GetUserId());
        return Ok(new { url });
    }

    /// <summary>Handle TikTok OAuth callback (exchange code for tokens)</summary>
    [HttpPost("tiktok/callback")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> TikTokCallback([FromBody] TikTokCallbackRequest request)
        => ToActionResult(await _tiktok.HandleCallbackAsync(GetUserId(), request.Code));

    /// <summary>Get TikTok connection status</summary>
    [HttpGet("tiktok/status")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> GetTikTokStatus()
        => ToActionResult(await _tiktok.GetConnectionStatusAsync(GetUserId()));

    /// <summary>Disconnect TikTok account</summary>
    [HttpDelete("tiktok/disconnect")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> DisconnectTikTok()
        => ToActionResult(await _tiktok.DisconnectAsync(GetUserId()));
}
