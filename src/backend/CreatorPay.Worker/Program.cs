using CreatorPay.Application.Interfaces;
using CreatorPay.Infrastructure;
using CreatorPay.Worker.Jobs;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

var host = Host.CreateDefaultBuilder(args)
    .UseContentRoot(AppContext.BaseDirectory)
    .UseSerilog()
    .ConfigureAppConfiguration((context, cfg) =>
    {
        var env = context.HostingEnvironment;
        var workerDir = Path.GetDirectoryName(typeof(Program).Assembly.Location)!;
        cfg.SetBasePath(workerDir)
           .AddJsonFile("appsettings.json", optional: true)
           .AddJsonFile($"appsettings.{env.EnvironmentName}.json", optional: true)
           .AddEnvironmentVariables();
    })
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;

        // Infrastructure (DbContext, repos, services)
        services.AddInfrastructure(config);

        // Payout engine – all calculator implementations + factory
        services.AddPayoutEngine();

        // Jobs
        services.AddScoped<DailyCampaignSyncJob>();
        services.AddScoped<ICampaignSyncTrigger, DailyCampaignSyncJob>();
        services.AddScoped<CampaignExpirationJob>();
        services.AddScoped<TokenRefreshJob>();
        services.AddScoped<FraudDetectionJob>();
        services.AddScoped<PayoutSettlementJob>();
        services.AddScoped<PayoutRecalculationJob>();

        // Hangfire
        services.AddHangfire(cfg =>
            cfg.UsePostgreSqlStorage(options =>
                options.UseNpgsqlConnection(config.GetConnectionString("DefaultConnection"))));
        services.AddHangfireServer();
    })
    .Build();

// Register recurring jobs
using (var scope = host.Services.CreateScope())
{
    var manager = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();

    // Daglig kampanjsynk – var 15:e minut (dev) / kl 03:00 UTC (prod)
    manager.AddOrUpdate<DailyCampaignSyncJob>(
        "daily-campaign-sync",
        job => job.ExecuteAsync(),
        "*/15 * * * *");

    // Kampanj-expiration – kl 01:00 UTC
    manager.AddOrUpdate<CampaignExpirationJob>(
        "campaign-expiration",
        job => job.ExecuteAsync(),
        "0 1 * * *");

    // Token-refresh – var 6:e timme
    manager.AddOrUpdate<TokenRefreshJob>(
        "token-refresh",
        job => job.ExecuteAsync(),
        "0 */6 * * *");

    // Bedrägeridentifiering – kl 05:00 UTC
    manager.AddOrUpdate<FraudDetectionJob>(
        "fraud-detection",
        job => job.ExecuteAsync(),
        "0 5 * * *");

    // Utbetalningsavstämning – var 4:e timme
    manager.AddOrUpdate<PayoutSettlementJob>(
        "payout-settlement",
        job => job.ExecuteAsync(),
        "0 */4 * * *");

    // Utbetalningsberäkning – kl 04:00 UTC (efter sync)
    manager.AddOrUpdate<PayoutRecalculationJob>(
        "payout-recalculation",
        job => job.ExecuteAsync(CancellationToken.None),
        "0 4 * * *");
}

Log.Information("CreatorPay Worker started with {Count} recurring jobs", 6);
await host.RunAsync();
