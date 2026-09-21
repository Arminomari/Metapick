using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;

namespace CreatorPay.Application.Interfaces;

public interface IBrandAnalyticsService
{
    Task<Result<BrandAnalyticsSummaryDto>> GetSummaryAsync(Guid brandUserId, CancellationToken ct = default);
}

public interface ICreatorAnalyticsService
{
    Task<Result<CreatorAnalyticsDto>> GetAsync(Guid creatorUserId, CancellationToken ct = default);
}
