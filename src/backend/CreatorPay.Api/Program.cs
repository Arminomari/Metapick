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

// ── FluentValidation ───────────────────────────────────
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();

// ── JWT Authentication ─────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is required");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1)
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
    // Auth endpoints: max 10 requests/minute per IP (brute-force protection)
    options.AddFixedWindowLimiter("auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
    });

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
        var configured = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();
        var fromEnv = (builder.Configuration["CORS_ORIGINS"] ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var origins = (configured ?? []).Concat(fromEnv).Distinct().ToArray();
        if (origins.Length == 0) origins = ["http://localhost:5173"];

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
// HangfireServer only on Worker – API is client-only

// ── Health checks ─────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddCheck<CreatorPay.Api.Middleware.DatabaseHealthCheck>("database", tags: ["ready"]);
builder.Services.AddScoped<CreatorPay.Api.Middleware.DatabaseHealthCheck>();

// ── Controllers & Swagger ──────────────────────────────
builder.Services.AddControllers();
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

var app = builder.Build();

// ── Middleware pipeline ─────────────────────────────────
app.UseMiddleware<GlobalExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

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
    var encryption = scope.ServiceProvider.GetRequiredService<CreatorPay.Application.Interfaces.IEncryptionService>();
    if (!await db.Users.AnyAsync(u => u.Role == CreatorPay.Domain.Enums.UserRole.Admin))
    {
        var admin = new CreatorPay.Domain.Entities.User
        {
            Email = "admin@metapick.se",
            PasswordHash = encryption.HashPassword("Admin123!"),
            FirstName = "Admin",
            LastName = "MetaPick",
            Role = CreatorPay.Domain.Enums.UserRole.Admin,
            Status = CreatorPay.Domain.Enums.UserStatus.Active,
            EmailVerified = true
        };
        db.Users.Add(admin);

        var adminProfile = new CreatorPay.Domain.Entities.AdminProfile
        {
            UserId = admin.Id,
            Department = "Platform",
            PermissionLevel = CreatorPay.Domain.Enums.AdminLevel.SuperAdmin
        };
        db.Set<CreatorPay.Domain.Entities.AdminProfile>().Add(adminProfile);

        await db.SaveChangesAsync();
        Log.Information("Seeded admin account: admin@metapick.se");
    }
}

Log.Information("CreatorPay API starting on {Env}", app.Environment.EnvironmentName);
app.Run();

// Make Program accessible to integration tests
public partial class Program { }
