using CreatorPay.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // ── Users & profiles ───────────────────────────────
    public DbSet<User> Users => Set<User>();
    public DbSet<AdminProfile> AdminProfiles => Set<AdminProfile>();
    public DbSet<BrandProfile> BrandProfiles => Set<BrandProfile>();
    public DbSet<CreatorProfile> CreatorProfiles => Set<CreatorProfile>();
    public DbSet<TikTokAccount> TikTokAccounts => Set<TikTokAccount>();

    // ── Campaigns ──────────────────────────────────────
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<CampaignRequirement> CampaignRequirements => Set<CampaignRequirement>();
    public DbSet<CampaignRule> CampaignRules => Set<CampaignRule>();
    public DbSet<PayoutRule> PayoutRules => Set<PayoutRule>();
    public DbSet<CampaignApplication> CampaignApplications => Set<CampaignApplication>();
    public DbSet<CreatorCampaignAssignment> Assignments => Set<CreatorCampaignAssignment>();
    public DbSet<TrackingTag> TrackingTags => Set<TrackingTag>();

    // ── Social posts & verification ────────────────────
    public DbSet<CreatorSubmission> Submissions => Set<CreatorSubmission>();
    public DbSet<SocialPost> SocialPosts => Set<SocialPost>();
    public DbSet<SocialPostMetricSnapshot> MetricSnapshots => Set<SocialPostMetricSnapshot>();
    public DbSet<ViewVerificationRecord> ViewVerificationRecords => Set<ViewVerificationRecord>();

    // ── Payouts ────────────────────────────────────────
    public DbSet<PayoutCalculation> PayoutCalculations => Set<PayoutCalculation>();
    public DbSet<PayoutRequest> PayoutRequests => Set<PayoutRequest>();
    public DbSet<PayoutTransaction> PayoutTransactions => Set<PayoutTransaction>();
    public DbSet<BrandWallet> BrandWallets => Set<BrandWallet>();

    // ── System ─────────────────────────────────────────
    public DbSet<FraudFlag> FraudFlags => Set<FraudFlag>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Dispute> Disputes => Set<Dispute>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("public");

        // Apply all IEntityTypeConfiguration from this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Global query filter for soft-deleted entities
        modelBuilder.Entity<User>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Campaign>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<BrandProfile>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<CreatorProfile>().HasQueryFilter(e => !e.IsDeleted);

        // Store string[] as JSON text columns
        modelBuilder.Entity<Campaign>()
            .Property(e => e.ContentTags)
            .HasColumnType("text")
            .HasConversion(
                v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                v => System.Text.Json.JsonSerializer.Deserialize<string[]>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? Array.Empty<string>());
        modelBuilder.Entity<CreatorProfile>()
            .Property(e => e.ProfileTags)
            .HasColumnType("text")
            .HasConversion(
                v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                v => System.Text.Json.JsonSerializer.Deserialize<string[]>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? Array.Empty<string>());

        // Store all enums as strings
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType.IsEnum)
                {
                    property.SetProviderClrType(typeof(string));
                }
            }
        }
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<Domain.Common.BaseEntity>())
        {
            if (entry.State == EntityState.Added)
                entry.Entity.CreatedAt = now;
            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = now;
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
