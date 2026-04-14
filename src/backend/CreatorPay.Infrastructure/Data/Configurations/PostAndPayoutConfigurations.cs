using CreatorPay.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CreatorPay.Infrastructure.Data.Configurations;

public class SubmissionConfiguration : IEntityTypeConfiguration<CreatorSubmission>
{
    public void Configure(EntityTypeBuilder<CreatorSubmission> b)
    {
        b.ToTable("creator_submissions");
        b.HasKey(e => e.Id);
        b.Property(e => e.TikTokVideoUrl).HasMaxLength(500).IsRequired();
        b.Property(e => e.TikTokVideoId).HasMaxLength(100);
        b.Property(e => e.Notes).HasMaxLength(2000);
        b.Property(e => e.Status).HasMaxLength(30).IsRequired();
        b.HasIndex(e => e.TikTokVideoId);
        b.HasIndex(e => e.AssignmentId);

        b.HasOne(e => e.SocialPost).WithOne(p => p.Submission)
            .HasForeignKey<SocialPost>(p => p.SubmissionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class SocialPostConfiguration : IEntityTypeConfiguration<SocialPost>
{
    public void Configure(EntityTypeBuilder<SocialPost> b)
    {
        b.ToTable("social_posts");
        b.HasKey(e => e.Id);
        b.Property(e => e.TikTokVideoId).HasMaxLength(100).IsRequired();
        b.Property(e => e.TikTokUrl).HasMaxLength(500);
        b.Property(e => e.Caption).HasMaxLength(2000);
        b.Property(e => e.VerificationStatus).HasMaxLength(30);
        b.HasIndex(e => e.TikTokVideoId).IsUnique();

        b.HasMany(e => e.MetricSnapshots).WithOne(s => s.SocialPost)
            .HasForeignKey(s => s.SocialPostId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(e => e.VerificationRecords).WithOne(v => v.SocialPost)
            .HasForeignKey(v => v.SocialPostId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class MetricSnapshotConfiguration : IEntityTypeConfiguration<SocialPostMetricSnapshot>
{
    public void Configure(EntityTypeBuilder<SocialPostMetricSnapshot> b)
    {
        b.ToTable("social_post_metric_snapshots");
        b.HasKey(e => e.Id);
        b.Property(e => e.Source).HasMaxLength(30);
        b.HasIndex(e => new { e.SocialPostId, e.SnapshotDate });
    }
}

public class ViewVerificationConfiguration : IEntityTypeConfiguration<ViewVerificationRecord>
{
    public void Configure(EntityTypeBuilder<ViewVerificationRecord> b)
    {
        b.ToTable("view_verification_records");
        b.HasKey(e => e.Id);
        b.Property(e => e.VerificationMethod).HasMaxLength(30);
        b.Property(e => e.ConfidenceScore).HasPrecision(5, 4);
        b.Property(e => e.Notes).HasMaxLength(2000);
        b.HasIndex(e => e.SocialPostId);
    }
}

public class PayoutCalculationConfiguration : IEntityTypeConfiguration<PayoutCalculation>
{
    public void Configure(EntityTypeBuilder<PayoutCalculation> b)
    {
        b.ToTable("payout_calculations");
        b.HasKey(e => e.Id);
        b.Property(e => e.CalculatedAmount).HasPrecision(18, 2);
        b.Property(e => e.CalculationDetails).HasMaxLength(4000);
        b.Property(e => e.Status).HasMaxLength(30);
        b.HasIndex(e => e.AssignmentId);
    }
}

public class PayoutRequestConfiguration : IEntityTypeConfiguration<PayoutRequest>
{
    public void Configure(EntityTypeBuilder<PayoutRequest> b)
    {
        b.ToTable("payout_requests");
        b.HasKey(e => e.Id);
        b.Property(e => e.RequestedAmount).HasPrecision(18, 2);
        b.Property(e => e.Currency).HasMaxLength(5).HasDefaultValue("SEK");
        b.Property(e => e.Status).HasMaxLength(20);
        b.Property(e => e.RejectionReason).HasMaxLength(1000);
        b.HasIndex(e => e.CreatorProfileId);
        b.HasIndex(e => e.Status);
    }
}

public class PayoutTransactionConfiguration : IEntityTypeConfiguration<PayoutTransaction>
{
    public void Configure(EntityTypeBuilder<PayoutTransaction> b)
    {
        b.ToTable("payout_transactions");
        b.HasKey(e => e.Id);
        b.Property(e => e.Amount).HasPrecision(18, 2);
        b.Property(e => e.Currency).HasMaxLength(5);
        b.Property(e => e.Status).HasMaxLength(20);
        b.Property(e => e.ExternalTransactionId).HasMaxLength(200);
        b.Property(e => e.FailureReason).HasMaxLength(1000);
        b.HasIndex(e => e.PayoutRequestId);
    }
}

public class BrandWalletConfiguration : IEntityTypeConfiguration<BrandWallet>
{
    public void Configure(EntityTypeBuilder<BrandWallet> b)
    {
        b.ToTable("brand_wallets");
        b.HasKey(e => e.Id);
        b.Property(e => e.Balance).HasPrecision(18, 2).HasDefaultValue(0);
        b.Property(e => e.TotalDeposited).HasPrecision(18, 2).HasDefaultValue(0);
        b.Property(e => e.TotalSpent).HasPrecision(18, 2).HasDefaultValue(0);
        b.Property(e => e.Currency).HasMaxLength(5).HasDefaultValue("SEK");
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.HasIndex(e => e.BrandProfileId).IsUnique();
    }
}

public class FraudFlagConfiguration : IEntityTypeConfiguration<FraudFlag>
{
    public void Configure(EntityTypeBuilder<FraudFlag> b)
    {
        b.ToTable("fraud_flags");
        b.HasKey(e => e.Id);
        b.Property(e => e.EntityType).HasMaxLength(30);
        b.Property(e => e.FlagType).HasMaxLength(50);
        b.Property(e => e.Severity).HasMaxLength(20);
        b.Property(e => e.Description).HasMaxLength(2000);
        b.Property(e => e.Status).HasMaxLength(20);
        b.Property(e => e.Resolution).HasMaxLength(2000);
        b.HasIndex(e => e.Status);
        b.HasIndex(e => new { e.EntityType, e.EntityId });
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.ToTable("audit_logs");
        b.HasKey(e => e.Id);
        b.Property(e => e.Action).HasMaxLength(100).IsRequired();
        b.Property(e => e.EntityType).HasMaxLength(100);
        b.Property(e => e.IpAddress).HasMaxLength(50);
        b.HasIndex(e => e.UserId);
        b.HasIndex(e => new { e.EntityType, e.EntityId });
        b.HasIndex(e => e.CreatedAt);
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("notifications");
        b.HasKey(e => e.Id);
        b.Property(e => e.Type).HasMaxLength(50);
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Message).HasMaxLength(2000).IsRequired();
        b.HasIndex(e => new { e.UserId, e.IsRead });
        b.HasIndex(e => e.CreatedAt);
    }
}

public class DisputeConfiguration : IEntityTypeConfiguration<Dispute>
{
    public void Configure(EntityTypeBuilder<Dispute> b)
    {
        b.ToTable("disputes");
        b.HasKey(e => e.Id);
        b.Property(e => e.Type).HasMaxLength(30);
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Description).HasMaxLength(2000).IsRequired();
        b.Property(e => e.Status).HasMaxLength(20);
        b.Property(e => e.Resolution).HasMaxLength(2000);
        b.HasIndex(e => e.Status);
    }
}
