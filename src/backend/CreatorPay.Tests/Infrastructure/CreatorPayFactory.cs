using CreatorPay.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace CreatorPay.Tests.Infrastructure;

public class CreatorPayFactory : WebApplicationFactory<CreatorPay.Api.ApiMarker>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("creatorpay_test")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    public string ConnectionString => _postgres.GetConnectionString();

    /// <summary>
    /// The running fixture, so HttpClient helpers can reach the database without
    /// every test method threading the factory through. One per collection.
    /// </summary>
    internal static CreatorPayFactory? Current { get; private set; }

    /// <summary>
    /// Marks a registered user's email as confirmed. Registration sends a link the
    /// tests cannot click, and applying for work requires a proven inbox.
    /// </summary>
    public async Task MarkEmailVerified(string email)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower());
        if (user is { EmailVerified: false })
        {
            user.EmailVerified = true;
            await db.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Turns an OAuth connection back into a typed handle: active, but with no
    /// token and the "manual" scope. This is what an unconnected creator looks
    /// like, and TikTokAccountExtensions.IsVerified() must reject it.
    /// </summary>
    public async Task MakeTikTokManual(string email)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await db.TikTokAccounts.IgnoreQueryFilters()
            .Include(a => a.CreatorProfile).ThenInclude(c => c.User)
            .FirstOrDefaultAsync(a => a.CreatorProfile.User.Email.ToLower() == email.ToLower());
        if (account == null) return;
        account.Scopes = "manual";
        account.AccessTokenEncrypted = "";
        account.RefreshTokenEncrypted = "";
        account.TokenExpiresAt = DateTime.UtcNow.AddYears(-1);
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Marks the brand's organisation number as registry-verified, the way
    /// OrgVerificationService would after a VIES lookup. Going live requires it.
    /// </summary>
    public async Task MarkOrgVerified(string email, bool verified = true)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var brand = await db.BrandProfiles.IgnoreQueryFilters()
            .Include(b => b.User)
            .FirstOrDefaultAsync(b => b.User.Email.ToLower() == email.ToLower());
        if (brand == null) return;
        brand.OrgVerified = verified;
        brand.OrgVerifiedAt = verified ? DateTime.UtcNow : null;
        brand.OrgVerifiedName = verified ? "TESTBOLAG AB" : null;
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Upgrades the manual TikTok stub created at registration into what
    /// TikTokAccountExtensions.IsVerified() accepts: an active OAuth connection
    /// with a token. The real thing needs a TikTok round-trip, so tests take the
    /// shortcut; the rule itself is asserted separately.
    /// </summary>
    public async Task ConnectTikTok(string email, int followers = 12_000)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var creator = await db.CreatorProfiles.IgnoreQueryFilters()
            .Include(c => c.TikTokAccount)
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.User.Email.ToLower() == email.ToLower());
        if (creator == null) return;

        var account = creator.TikTokAccount;
        if (account == null)
        {
            account = new CreatorPay.Domain.Entities.TikTokAccount { CreatorProfileId = creator.Id };
            db.Add(account);
        }
        account.TikTokUserId = "oauth-" + Guid.NewGuid().ToString("N")[..12];
        // Same handle TestMedia.VideoUrl builds, so a test can post its own video.
        account.TikTokUsername = TestMedia.TikTokUsername(email);
        account.AccessTokenEncrypted = "test-access-token";
        account.RefreshTokenEncrypted = "test-refresh-token";
        account.TokenExpiresAt = DateTime.UtcNow.AddDays(30);
        account.Scopes = "user.info.profile,user.info.stats,video.list";
        account.IsActive = true;
        account.FollowerCount = followers;
        creator.FollowerCount = followers;
        await db.SaveChangesAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        // The API hosts the Hangfire server by default; tests run without one.
        builder.UseSetting("Hangfire:RunServerInApi", "false");
        // One HttpClient drives every test; the public limits would throttle it.
        builder.UseSetting("RateLimiting:Enabled", "false");
        // Uploads are served from an absolute path; keep test files out of the repo.
        builder.UseSetting("Storage:BasePath", Path.Combine(Path.GetTempPath(), "vyrle-tests-uploads"));

        builder.ConfigureServices(services =>
        {
            // Remove existing DbContext registration
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (descriptor != null) services.Remove(descriptor);

            // Remove the Hangfire registrations to avoid needing the real DB. The
            // hosted server registers itself as IHostedService through a factory,
            // so the service type alone does not identify it.
            var hangfireDescriptors = services.Where(d =>
                d.ServiceType.FullName?.Contains("Hangfire") == true
                || d.ImplementationType?.FullName?.Contains("Hangfire") == true
                || d.ImplementationFactory?.Method.DeclaringType?.FullName?.Contains("Hangfire") == true).ToList();
            foreach (var d in hangfireDescriptors) services.Remove(d);

            // Never call the EU VIES registry from tests.
            var registry = services.Where(d => d.ServiceType == typeof(CreatorPay.Application.Interfaces.IOrgNumberRegistry)).ToList();
            foreach (var d in registry) services.Remove(d);
            services.AddSingleton<CreatorPay.Application.Interfaces.IOrgNumberRegistry, TestOrgNumberRegistry>();

            // Add test PostgreSQL
            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(_postgres.GetConnectionString(), npgsql =>
                    npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)));
        });
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        Current = this;
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }
}

/// <summary>Stands in for VIES in tests: every Luhn-valid number counts as registered.</summary>
public sealed class TestOrgNumberRegistry : CreatorPay.Application.Interfaces.IOrgNumberRegistry
{
    public Task<CreatorPay.Application.Interfaces.OrgRegistryResult> LookupAsync(string tenDigitOrgNumber, CancellationToken ct = default)
        => Task.FromResult(new CreatorPay.Application.Interfaces.OrgRegistryResult(
            CreatorPay.Domain.Common.OrgNumber.IsValid(tenDigitOrgNumber), "TESTBOLAG AB", "Test"));
}
