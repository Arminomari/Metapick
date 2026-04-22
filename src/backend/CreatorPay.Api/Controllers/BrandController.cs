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
