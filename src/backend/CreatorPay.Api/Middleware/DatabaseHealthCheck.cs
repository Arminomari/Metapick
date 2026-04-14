using CreatorPay.Infrastructure.Data;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace CreatorPay.Api.Middleware;

/// <summary>
/// Readiness probe – verifies that the PostgreSQL database is reachable.
/// </summary>
public sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var ok = await db.Database.CanConnectAsync(cancellationToken);
            return ok
                ? HealthCheckResult.Healthy("PostgreSQL is reachable")
                : HealthCheckResult.Unhealthy("PostgreSQL is not reachable");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("PostgreSQL health check threw", ex);
        }
    }
}
