using System.Text;
using System.Threading.RateLimiting;
using CreatorPay.Api.Middleware;
using CreatorPay.Application.Validators;
using CreatorPay.Infrastructure;
using FluentValidation;
using FluentValidation.AspNetCore;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/creatorpay-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();
builder.Host.UseSerilog();

// ── Services ───────────────────────────────────────────
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddPayoutEngine();

// ── FluentValidation ───────────────────────────────────
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();

// ── JWT Authentication ─────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is required");

if (jwtSecret.Length < 32)
    throw new InvalidOperationException("Jwt:Secret must be at least 32 characters long");

if (!builder.Environment.IsDevelopment() && jwtSecret.Contains("CHANGE-THIS", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Production Jwt:Secret must not use placeholder values");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.SaveToken = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                // .NET's JWT handler remaps "sub" → ClaimTypes.NameIdentifier by default,
                // so check both names — otherwise every authenticated request fails with 401.
                var sub = context.Principal?.FindFirst("sub")?.Value
                    ?? context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!Guid.TryParse(sub, out _))
                    context.Fail("Invalid subject claim");
                return Task.CompletedTask;
            }
        };
    });

// ── Authorization ──────────────────────────────────────
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", p => p.RequireRole("Admin"))
    .AddPolicy("BrandOnly", p => p.RequireRole("Brand"))
    .AddPolicy("CreatorOnly", p => p.RequireRole("Creator"))
    .AddPolicy("BrandOrAdmin", p => p.RequireRole("Brand", "Admin"))
    .AddPolicy("CreatorOrAdmin", p => p.RequireRole("Creator", "Admin"))
    .AddPolicy("Authenticated", p => p.RequireAuthenticatedUser());

// ── Rate limiting ──────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    // Auth endpoints: max 10 requests/minute per IP (brute-force protection).
    // Must be partitioned by IP — a single shared window would let anyone
    // lock the whole internet out of login with 10 requests.
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Public tracking redirect endpoint: allow bursts but protect from abuse.
    options.AddPolicy("tracking", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Global: max 120 requests/minute per IP (general throttle)
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 5
            }));

    options.RejectionStatusCode = 429;
});

// ── CORS ───────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var configured = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
        var fromEnv = (builder.Configuration["CORS_ORIGINS"] ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        // Guaranteed production frontends so a missing/incorrect CORS_ORIGINS env can never lock auth out.
        var defaults = new List<string> { "https://www.vyrle.co", "https://vyrle.co" };
        if (builder.Environment.IsDevelopment()) defaults.Add("http://localhost:5173");
        var origins = configured.Concat(fromEnv).Concat(defaults)
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Distinct()
            .ToArray();

        policy.WithOrigins(origins)
              .WithHeaders("Content-Type", "Authorization", "Accept")
              .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
              .AllowCredentials();
    });
});

// ── Hangfire ───────────────────────────────────────────
var hangfireConn = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["DATABASE_URL"]
    ?? builder.Configuration["DATABASE_PRIVATE_URL"];
if (hangfireConn != null && hangfireConn.StartsWith("postgresql://"))
{
    var uri = new Uri(hangfireConn);
    var ui = uri.UserInfo.Split(':');
    hangfireConn = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={ui[0]};Password={ui[1]};SSL Mode=Require;Trust Server Certificate=true";
}
builder.Services.AddHangfire(config =>
    config.UsePostgreSqlStorage(options =>
        options.UseNpgsqlConnection(hangfireConn)));

// The background jobs normally run in the separate Worker service. On
// deployments without one (e.g. Railway today) the API hosts the Hangfire
// server itself — nothing would ever process the queue otherwise.
// Disable with Hangfire__RunServerInApi=false once a dedicated worker exists.
var runHangfireServerInApi = builder.Configuration.GetValue<bool?>("Hangfire:RunServerInApi") ?? true;
if (runHangfireServerInApi)
{
    builder.Services.AddHangfireServer(options => options.WorkerCount = 2);
    builder.Services.AddScoped<CreatorPay.Worker.Jobs.DailyCampaignSyncJob>();
    builder.Services.AddScoped<CreatorPay.Application.Interfaces.ICampaignSyncTrigger, CreatorPay.Worker.Jobs.DailyCampaignSyncJob>();
    builder.Services.AddScoped<CreatorPay.Worker.Jobs.CampaignExpirationJob>();
    builder.Services.AddScoped<CreatorPay.Worker.Jobs.TokenRefreshJob>();
    builder.Services.AddScoped<CreatorPay.Worker.Jobs.FraudDetectionJob>();
    builder.Services.AddScoped<CreatorPay.Worker.Jobs.PayoutSettlementJob>();
    builder.Services.AddScoped<CreatorPay.Worker.Jobs.PayoutRecalculationJob>();
}

// ── Health checks ─────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddCheck<CreatorPay.Api.Middleware.DatabaseHealthCheck>("database", tags: ["ready"]);
builder.Services.AddScoped<CreatorPay.Api.Middleware.DatabaseHealthCheck>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// ── Controllers & Swagger ──────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        opts.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "CreatorPay API",
        Version = "v1",
        Description = "TikTok Creator Marketplace – Views-based payout platform"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// Largest legitimate request is a register/profile payload with inline base64 media
// (~400k chars avatar + logo + JSON overhead). 2 MB leaves headroom; anything bigger is abuse.
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 2_097_152);

var app = builder.Build();

// ── Middleware pipeline ─────────────────────────────────
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseMiddleware<SecurityHeadersMiddleware>();

app.UseRateLimiter();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = [new CreatorPay.Api.Middleware.HangfireAuthFilter()]
});
app.MapControllers();

// ── Health checks ─────────────────────────────────────
// /health  → liveness (always 200 if app is up)
// /health/ready → readiness (checks DB)
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready",
    new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready")
    });

// ── Database migration (always) ───────────────────────
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<CreatorPay.Infrastructure.Data.AppDbContext>();
    await db.Database.MigrateAsync();

    // ── Seed admin account ─────────────────────────────
    var seedAdminEnabled = builder.Configuration.GetValue<bool?>("Bootstrap:SeedAdminEnabled")
        ?? app.Environment.IsDevelopment();
    if (seedAdminEnabled)
    {
        var encryption = scope.ServiceProvider.GetRequiredService<CreatorPay.Application.Interfaces.IEncryptionService>();
        // Trim + lowercase: whitespace pasted into an env var or a mixed-case
        // email must never produce an account that cannot log in.
        var adminEmail = (builder.Configuration["Bootstrap:AdminEmail"] ?? "").Trim().ToLowerInvariant();
        var adminPassword = (builder.Configuration["Bootstrap:AdminPassword"] ?? "").Trim();

        if (string.IsNullOrWhiteSpace(adminEmail) && app.Environment.IsDevelopment()) adminEmail = "admin@metapick.se";
        if (string.IsNullOrWhiteSpace(adminPassword) && app.Environment.IsDevelopment()) adminPassword = "Admin123!";

        if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
            throw new InvalidOperationException("Bootstrap admin credentials must be configured when Bootstrap:SeedAdminEnabled is true");
        if (!app.Environment.IsDevelopment() && adminPassword.Length < 12)
            throw new InvalidOperationException("Bootstrap admin password must be at least 12 characters outside development");

        var existingUser = await db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == adminEmail);

        if (existingUser == null)
        {
            var admin = new CreatorPay.Domain.Entities.User
            {
                Email = adminEmail,
                PasswordHash = encryption.HashPassword(adminPassword),
                FirstName = "Admin",
                LastName = "VYRLE",
                Role = CreatorPay.Domain.Enums.UserRole.Admin,
                Status = CreatorPay.Domain.Enums.UserStatus.Active,
                EmailVerified = true
            };
            db.Users.Add(admin);
            db.Set<CreatorPay.Domain.Entities.AdminProfile>().Add(new CreatorPay.Domain.Entities.AdminProfile
            {
                UserId = admin.Id,
                Department = "Platform",
                PermissionLevel = CreatorPay.Domain.Enums.AdminLevel.SuperAdmin
            });
            await db.SaveChangesAsync();
            Log.Information("Seeded admin account: {Email}", adminEmail);
        }
        else if (existingUser.Role == CreatorPay.Domain.Enums.UserRole.Admin)
        {
            // Recovery path: while seeding is enabled the configured credentials
            // always win, so a lost admin password is fixed by updating the
            // variable and redeploying. Disable seeding once logged in.
            existingUser.PasswordHash = encryption.HashPassword(adminPassword);
            existingUser.Status = CreatorPay.Domain.Enums.UserStatus.Active;
            existingUser.IsDeleted = false;
            existingUser.RefreshTokenHash = null;

            var hasProfile = await db.Set<CreatorPay.Domain.Entities.AdminProfile>()
                .AnyAsync(pr => pr.UserId == existingUser.Id);
            if (!hasProfile)
                db.Set<CreatorPay.Domain.Entities.AdminProfile>().Add(new CreatorPay.Domain.Entities.AdminProfile
                {
                    UserId = existingUser.Id,
                    Department = "Platform",
                    PermissionLevel = CreatorPay.Domain.Enums.AdminLevel.SuperAdmin
                });

            await db.SaveChangesAsync();
            Log.Warning("Bootstrap admin password reset from configuration for {Email}", adminEmail);
        }
        else
        {
            Log.Error("Bootstrap admin email {Email} belongs to a non-admin account — refusing to convert it", adminEmail);
        }
    }

    // ── Auto-approve all pending brand accounts ────────
    var autoApprovePendingBrands = builder.Configuration.GetValue<bool?>("Bootstrap:AutoApprovePendingBrands")
        ?? app.Environment.IsDevelopment();
    if (autoApprovePendingBrands)
    {
        var pendingBrandUsers = await db.Users
            .Where(u => u.Role == CreatorPay.Domain.Enums.UserRole.Brand
                     && u.Status == CreatorPay.Domain.Enums.UserStatus.PendingVerification)
            .ToListAsync();

        if (pendingBrandUsers.Count > 0)
        {
            var pendingBrandIds = pendingBrandUsers.Select(u => u.Id).ToList();
            var pendingBrandProfiles = await db.Set<CreatorPay.Domain.Entities.BrandProfile>()
                .Where(b => pendingBrandIds.Contains(b.UserId) && b.Status == CreatorPay.Domain.Enums.BrandStatus.Pending)
                .ToListAsync();
            foreach (var u in pendingBrandUsers) u.Status = CreatorPay.Domain.Enums.UserStatus.Active;
            foreach (var b in pendingBrandProfiles) b.Status = CreatorPay.Domain.Enums.BrandStatus.Approved;
            await db.SaveChangesAsync();
            Log.Warning("Bootstrap auto-approved {Count} pending brand accounts", pendingBrandUsers.Count);
        }
    }

    // ── Seed demo content (Discover/Dashboard/Portfolio) ──
    var seedDemoData = builder.Configuration.GetValue<bool?>("Bootstrap:SeedDemoDataEnabled") ?? false;
    if (seedDemoData)
    {
        var demoEncryption = scope.ServiceProvider.GetRequiredService<CreatorPay.Application.Interfaces.IEncryptionService>();
        await CreatorPay.Api.Bootstrap.DemoDataSeeder.SeedAsync(
            db, demoEncryption, builder.Configuration["Bootstrap:DemoCreatorEmail"]);
    }
    else if (builder.Configuration.GetValue<bool?>("Bootstrap:CleanupDemoDataEnabled") ?? false)
    {
        // Pre-launch cleanup: purge everything the demo seeder created.
        // Never allowed to block startup.
        try
        {
            await CreatorPay.Api.Bootstrap.DemoDataSeeder.CleanupAsync(db);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Demo data cleanup failed — continuing startup");
        }
    }

    // ── Recurring jobs (only when the API hosts the Hangfire server) ──
    if (runHangfireServerInApi)
    {
        var recurring = scope.ServiceProvider.GetRequiredService<Hangfire.IRecurringJobManager>();
        recurring.AddOrUpdate<CreatorPay.Worker.Jobs.DailyCampaignSyncJob>(
            "daily-campaign-sync", j => j.ExecuteAsync(),
            builder.Configuration["Jobs:CampaignSyncCron"] ?? "*/10 * * * *");
        recurring.AddOrUpdate<CreatorPay.Worker.Jobs.CampaignExpirationJob>(
            "campaign-expiration", j => j.ExecuteAsync(), "0 1 * * *");
        recurring.AddOrUpdate<CreatorPay.Worker.Jobs.TokenRefreshJob>(
            "token-refresh", j => j.ExecuteAsync(), "0 */6 * * *");
        recurring.AddOrUpdate<CreatorPay.Worker.Jobs.FraudDetectionJob>(
            "fraud-detection", j => j.ExecuteAsync(), "0 5 * * *");
        recurring.AddOrUpdate<CreatorPay.Worker.Jobs.PayoutSettlementJob>(
            "payout-settlement", j => j.ExecuteAsync(), "0 */4 * * *");
        recurring.AddOrUpdate<CreatorPay.Worker.Jobs.PayoutRecalculationJob>(
            "payout-recalculation", j => j.ExecuteAsync(CancellationToken.None),
            builder.Configuration["Jobs:PayoutRecalcCron"] ?? "*/15 * * * *");
        Log.Information("Hangfire server + recurring jobs hosted in API process");
    }

    // ── Seed launch brand account (only the bcrypt hash lives in the repo;
    //    the password is held by the owner) ─────────────────────────────
    var seedBrandAccount = builder.Configuration.GetValue<bool?>("Bootstrap:SeedBrandAccountEnabled") ?? false;
    if (seedBrandAccount && !await db.Users.AnyAsync(u => u.Email == "nellie@vyrle.co"))
    {
        var brandUser = new CreatorPay.Domain.Entities.User
        {
            Email = "nellie@vyrle.co",
            PasswordHash = "$2b$12$n1yfyDCZ6WmG9mQyElb/Y.9b6hK2Mq1i.OdkZ/.AOVZGN/SCLGhAa",
            FirstName = "Nellie",
            LastName = "Vyrle",
            Role = CreatorPay.Domain.Enums.UserRole.Brand,
            Status = CreatorPay.Domain.Enums.UserStatus.Active,
            EmailVerified = true
        };
        db.Users.Add(brandUser);

        db.Set<CreatorPay.Domain.Entities.BrandProfile>().Add(new CreatorPay.Domain.Entities.BrandProfile
        {
            UserId = brandUser.Id,
            CompanyName = "Nellie",
            Industry = "Fashion",
            Country = "SE",
            Description = "Nellie – mode och livsstil.",
            Status = CreatorPay.Domain.Enums.BrandStatus.Approved,
            ReviewedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
        Log.Information("Seeded brand account nellie@vyrle.co");
    }
}

Log.Information("CreatorPay API starting on {Env}", app.Environment.EnvironmentName);
app.Run();

// Make Program accessible to integration tests
public partial class Program { }

namespace CreatorPay.Api
{
    /// <summary>
    /// Entry-point marker for WebApplicationFactory in tests. The generated
    /// Program type is ambiguous now that the API also references the Worker
    /// assembly (to host its Hangfire jobs in-process).
    /// </summary>
    public sealed class ApiMarker { }
}
