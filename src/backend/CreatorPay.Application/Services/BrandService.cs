using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

public class BrandService : IBrandService
{
    private readonly IRepository<BrandProfile> _brands;
    private readonly IUnitOfWork _uow;

    public BrandService(IRepository<BrandProfile> brands, IUnitOfWork uow)
    {
        _brands = brands;
        _uow = uow;
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

        await _uow.SaveChangesAsync();
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

    private static BrandProfileDto MapToDto(BrandProfile b) =>
        new(b.Id, b.CompanyName, b.OrganizationNumber, b.Website,
            b.Industry, b.Country, b.Description, b.LogoUrl,
            b.ContactPhone, b.Status.ToString(), b.CreatedAt);
}
