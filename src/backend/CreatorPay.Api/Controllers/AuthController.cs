using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CreatorPay.Api.Controllers;

[Route("api/auth")]
public class AuthController : BaseController
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        => ToActionResult(await _auth.RegisterAsync(request));

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
        => ToActionResult(await _auth.LoginAsync(request));

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
        => ToActionResult(await _auth.RefreshTokenAsync(request));

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
        => ToActionResult(await _auth.LogoutAsync(GetUserId()));

    [HttpGet("profile")]
    [Authorize]
    public async Task<IActionResult> GetProfile()
        => ToActionResult(await _auth.GetProfileAsync(GetUserId()));

    [HttpPost("change-password")]
    [Authorize]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        => ToActionResult(await _auth.ChangePasswordAsync(GetUserId(), request));
}
