using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Common;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Services;

public class BrandService : IBrandService
{
    private readonly IRepository<BrandProfile> _brands;
    private readonly IUnitOfWork _uow;
    private readonly OrgVerificationService _orgVerification;
    private readonly ILogger<BrandService> _logger;

    public BrandService(IRepository<BrandProfile> brands, IUnitOfWork uow, OrgVerificationService orgVerification, ILogger<BrandService> logger)
    {
        _brands = brands;
        _uow = uow;
        _orgVerification = orgVerification;
        _logger = logger;
    }

    public async Task<Result<BrandProfileDto>> GetProfileAsync(Guid userId)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId);
        if (brand == null) return Errors.NotFound("Brand profile");
        return MapToDto(brand);
    }

    public async Task<Result<BrandProfileDto>> UpdateProfileAsync(Guid userId, UpdateBrandProfileRequest request)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId);
        if (brand == null) return Errors.NotFound("Brand profile");

        brand.CompanyName = request.CompanyName;
        brand.Website = request.Website;
        brand.Industry = request.Industry;
        brand.Description = request.Description;
        brand.ContactPhone = request.ContactPhone;

        // Org.nr is what lets a brand order video; it is normalised to XXXXXX-XXXX
        // and never blanked from here (leave the field empty to keep the old one).
        // The number itself is user input; whether it is VERIFIED is decided by
        // OrgVerificationService against the registry, never by this form.
        var numberChanged = false;
        if (!string.IsNullOrWhiteSpace(request.OrganizationNumber))
        {
            var normalized = OrgNumber.Normalize(request.OrganizationNumber);
            if (normalized == null)
                return Errors.Validation("Organisationsnummer ska vara 10 siffror (XXXXXX-XXXX).");
            if (!OrgNumber.IsValid(normalized))
                return Errors.Validation("Organisationsnumret är inte giltigt — kontrollsiffran stämmer inte.");
            numberChanged = !string.Equals(brand.OrganizationNumber, normalized, StringComparison.Ordinal);
            brand.OrganizationNumber = normalized;
        }
        if (request.LogoUrl != null)
        {
            if (!MediaValidation.IsValidImageRef(request.LogoUrl))
                return Errors.Validation("Logotypen är ogiltig eller för stor");
            // Empty string clears the logo; null means "leave unchanged".
            brand.LogoUrl = MediaValidation.Normalize(request.LogoUrl);
        }

        if (request.CoverUrl != null)
        {
            if (!MediaValidation.IsValidImageRef(request.CoverUrl))
                return Errors.Validation("Omslagsbilden är ogiltig eller för stor");
            brand.CoverUrl = MediaValidation.Normalize(request.CoverUrl);
        }

        if (brand.OrganizationNumber != null && (numberChanged || !brand.OrgVerified))
            await TryVerifyAsync(brand, numberChanged);

        await _uow.SaveChangesAsync();
        return MapToDto(brand);
    }

    /// <summary>Re-runs the registry check on demand (the "Verifiera igen" button).</summary>
    public async Task<Result<BrandProfileDto>> VerifyOrgAsync(Guid userId)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId);
        if (brand == null) return Errors.NotFound("Brand profile");
        if (string.IsNullOrWhiteSpace(brand.OrganizationNumber))
            return Errors.Validation("Lägg till organisationsnummer först.");

        var outcome = await _orgVerification.VerifyAsync(brand, numberChanged: false);
        await _uow.SaveChangesAsync();
        if (!outcome.Verified) return Errors.Validation(outcome.Message);
        return MapToDto(brand);
    }

    /// <summary>Admin decision after seeing registration documents; the only path besides the registry.</summary>
    public async Task<Result<BrandProfileDto>> SetOrgVerifiedByAdminAsync(Guid brandId, Guid adminId, bool verified, string? registeredName)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.Id == brandId);
        if (brand == null) return Errors.NotFound("Brand");
        if (verified && string.IsNullOrWhiteSpace(brand.OrganizationNumber))
            return Errors.Validation("Företaget saknar organisationsnummer.");
        OrgVerificationService.SetByAdmin(brand, verified, registeredName);
        brand.ReviewedBy = adminId;
        await _uow.SaveChangesAsync();
        _logger.LogInformation("Admin {AdminId} set OrgVerified={Verified} for brand {BrandId}", adminId, verified, brandId);
        return MapToDto(brand);
    }

    public async Task<Result<BrandProfileDto>> CompleteOnboardingAsync(Guid userId, UpdateBrandProfileRequest request)
        => await UpdateProfileAsync(userId, request);

    public async Task<Result<PagedResult<BrandListDto>>> ListBrandsAsync(string? status, int page, int pageSize)
    {
        var query = _brands.Query().AsQueryable();
        if (Enum.TryParse<BrandStatus>(status, out var s))
            query = query.Where(b => b.Status == s);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(b => new BrandListDto(b.Id, b.CompanyName, b.Industry, b.Country, b.Status.ToString(), b.CreatedAt, b.Campaigns.Count))
            .ToListAsync();

        return new PagedResult<BrandListDto> { Data = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<Result<BrandProfileDto>> ApproveBrandAsync(Guid brandId, Guid adminId)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.Id == brandId);
        if (brand == null) return Errors.NotFound("Brand");
        brand.Status = BrandStatus.Approved;
        brand.ReviewedBy = adminId;
        brand.ReviewedAt = DateTime.UtcNow;
        // Approval is a good moment to retry the registry if the number is still unverified.
        if (!brand.OrgVerified && brand.OrganizationNumber != null)
            await TryVerifyAsync(brand, numberChanged: false);
        await _uow.SaveChangesAsync();
        return MapToDto(brand);
    }

    public async Task<Result<BrandProfileDto>> RejectBrandAsync(Guid brandId, Guid adminId, string reason)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.Id == brandId);
        if (brand == null) return Errors.NotFound("Brand");
        brand.Status = BrandStatus.Rejected;
        brand.ReviewedBy = adminId;
        brand.ReviewedAt = DateTime.UtcNow;
        brand.RejectionReason = reason;
        await _uow.SaveChangesAsync();
        return MapToDto(brand);
    }

    private async Task TryVerifyAsync(BrandProfile brand, bool numberChanged)
    {
        try { await _orgVerification.VerifyAsync(brand, numberChanged); }
        catch (Exception ex) { _logger.LogWarning(ex, "Org verification failed for brand {BrandId}", brand.Id); }
    }

    internal static BrandProfileDto MapToDto(BrandProfile b) =>
        new(b.Id, b.CompanyName, b.OrganizationNumber, b.Website,
            b.Industry, b.Country, b.Description, b.LogoUrl,
            b.ContactPhone, b.Status.ToString(), b.CreatedAt,
            b.OrgVerified, b.OrgVerifiedAt, b.OrgVerifiedName, b.OrgVerificationSource, b.OrgVerificationCheckedAt,
            b.CoverUrl);
}
