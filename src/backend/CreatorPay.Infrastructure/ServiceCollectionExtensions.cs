using CreatorPay.Application.Interfaces;
using CreatorPay.Application.PayoutEngine;
using CreatorPay.Application.Services;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Infrastructure.Data;
using CreatorPay.Infrastructure.Repositories;
using CreatorPay.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CreatorPay.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        // ── Database ───────────────────────────────────
        // Support both Npgsql format and Railway's postgresql:// URL format
        var connStr = config.GetConnectionString("DefaultConnection")
            ?? config["DATABASE_URL"]
            ?? config["DATABASE_PRIVATE_URL"];

        if (connStr != null && connStr.StartsWith("postgresql://"))
        {
            var uri = new Uri(connStr);
            var userInfo = uri.UserInfo.Split(':');
            connStr = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={userInfo[1]};SSL Mode=Require;Trust Server Certificate=true";
        }

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connStr,
                npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)));

        // ── Repositories ───────────────────────────────
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // ── Application services ───────────────────────
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAdminUserService, AdminUserService>();
        services.AddScoped<IBrandService, BrandService>();
        services.AddScoped<ICreatorService, CreatorService>();
        services.AddScoped<ICampaignService, CampaignService>();
        services.AddScoped<IApplicationService, ApplicationService>();
        services.AddScoped<IAssignmentService, AssignmentService>();
        services.AddScoped<IPayoutService, PayoutService>();
        services.AddScoped<IFraudService, FraudService>();
        services.AddScoped<ITikTokConnectService, TikTokConnectService>();
        services.AddSingleton(new TikTokSettings
        {
            ClientKey = config["TikTok:ClientKey"] ?? "",
            RedirectUri = config["TikTok:RedirectUri"] ?? ""
        });
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<IReviewService, ReviewService>();
        services.AddScoped<IChatService, ChatService>();

        // ── Infrastructure services ────────────────────
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IEncryptionService, EncryptionService>();
        services.AddScoped<IFileStorageService, FileStorageService>();

        // ── External services ──────────────────────────
        // Standard resilience pipeline: retry (3x exp backoff + jitter),
        // circuit breaker (60% failure ratio), 30s total timeout.
        services.AddHttpClient<ITikTokApiClient, TikTokApiClient>()
            .AddStandardResilienceHandler(options =>
            {
                options.Retry.MaxRetryAttempts = 3;
                options.Retry.Delay = TimeSpan.FromSeconds(1);
                options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(45);
                options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
                options.CircuitBreaker.MinimumThroughput = 5;
                options.CircuitBreaker.FailureRatio = 0.6;
                options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(15);
            });
        services.AddScoped<IPayoutProvider, PayoutProviderService>();

        return services;
    }

    /// <summary>
    /// Registers the payout engine – all calculator implementations and the factory.
    /// Call this from Worker (and optionally API if needed).
    /// </summary>
    public static IServiceCollection AddPayoutEngine(this IServiceCollection services)
    {
        services.AddSingleton<IPayoutCalculator, FixedThresholdCalculator>();
        services.AddSingleton<IPayoutCalculator, TieredPayoutCalculator>();
        services.AddSingleton<IPayoutCalculator, CpmPayoutCalculator>();
        services.AddSingleton<IPayoutCalculator, HybridPayoutCalculator>();
        services.AddSingleton<PayoutCalculatorFactory>();
        return services;
    }
}
