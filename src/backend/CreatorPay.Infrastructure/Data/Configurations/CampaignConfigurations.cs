using CreatorPay.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CreatorPay.Infrastructure.Data.Configurations;

public class CampaignConfiguration : IEntityTypeConfiguration<Campaign>
{
    public void Configure(EntityTypeBuilder<Campaign> b)
    {
        b.ToTable("campaigns");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Description).HasMaxLength(5000).IsRequired();
        b.Property(e => e.TargetAudience).HasMaxLength(500);
        b.Property(e => e.Country).HasMaxLength(2);
        b.Property(e => e.Region).HasMaxLength(100);
        b.Property(e => e.Category).HasMaxLength(100).IsRequired();
        b.Property(e => e.RequiredHashtag).HasMaxLength(100);
        b.Property(e => e.ContentInstructions).HasMaxLength(5000);
        b.Property(e => e.ForbiddenContent).HasMaxLength(2000);
        b.Property(e => e.CoverImageUrl).HasMaxLength(1000);
        b.Property(e => e.Budget).HasPrecision(18, 2);
        b.Property(e => e.BudgetSpent).HasPrecision(18, 2).HasDefaultValue(0);
        b.Property(e => e.BudgetReserved).HasPrecision(18, 2).HasDefaultValue(0);
        b.Property(e => e.Status).HasMaxLength(30).IsRequired();
        b.Property(e => e.PayoutModel).HasMaxLength(20).IsRequired();
        b.Property(e => e.ModerationStatus).HasMaxLength(30);
        b.Property(e => e.ReviewMode).HasMaxLength(30);
        b.Property(e => e.IsDeleted).HasDefaultValue(false);
        b.Property(e => e.RowVersion).IsConcurrencyToken();

        b.HasIndex(e => e.Status);
        b.HasIndex(e => e.BrandProfileId);
        b.HasIndex(e => new { e.Status, e.EndDate });

        b.HasMany(e => e.Requirements).WithOne(r => r.Campaign)
            .HasForeignKey(r => r.CampaignId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(e => e.Rules).WithOne(r => r.Campaign)
            .HasForeignKey(r => r.CampaignId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(e => e.PayoutRules).WithOne(r => r.Campaign)
            .HasForeignKey(r => r.CampaignId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(e => e.Applications).WithOne(a => a.Campaign)
            .HasForeignKey(a => a.CampaignId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(e => e.Assignments).WithOne(a => a.Campaign)
            .HasForeignKey(a => a.CampaignId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class CampaignRequirementConfiguration : IEntityTypeConfiguration<CampaignRequirement>
{
    public void Configure(EntityTypeBuilder<CampaignRequirement> b)
    {
        b.ToTable("campaign_requirements");
        b.HasKey(e => e.Id);
        b.Property(e => e.RequirementType).HasMaxLength(50).IsRequired();
        b.Property(e => e.Value).HasMaxLength(500).IsRequired();
    }
}

public class CampaignRuleConfiguration : IEntityTypeConfiguration<CampaignRule>
{
    public void Configure(EntityTypeBuilder<CampaignRule> b)
    {
        b.ToTable("campaign_rules");
        b.HasKey(e => e.Id);
        b.Property(e => e.RuleType).HasMaxLength(50).IsRequired();
        b.Property(e => e.Description).HasMaxLength(1000).IsRequired();
    }
}

public class PayoutRuleConfiguration : IEntityTypeConfiguration<PayoutRule>
{
    public void Configure(EntityTypeBuilder<PayoutRule> b)
    {
        b.ToTable("payout_rules");
        b.HasKey(e => e.Id);
        b.Property(e => e.PayoutType).HasMaxLength(20).IsRequired();
        b.Property(e => e.Amount).HasPrecision(18, 2);
        b.Property(e => e.MaxPayoutPerCreator).HasPrecision(18, 2);
        b.HasIndex(e => e.CampaignId);
    }
}

public class CampaignApplicationConfiguration : IEntityTypeConfiguration<CampaignApplication>
{
    public void Configure(EntityTypeBuilder<CampaignApplication> b)
    {
        b.ToTable("campaign_applications");
        b.HasKey(e => e.Id);
        b.Property(e => e.Message).HasMaxLength(2000);
        b.Property(e => e.RejectionReason).HasMaxLength(1000);
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.HasIndex(e => new { e.CampaignId, e.CreatorProfileId });
        b.HasIndex(e => e.Status);
    }
}

public class AssignmentConfiguration : IEntityTypeConfiguration<CreatorCampaignAssignment>
{
    public void Configure(EntityTypeBuilder<CreatorCampaignAssignment> b)
    {
        b.ToTable("creator_campaign_assignments");
        b.HasKey(e => e.Id);
        b.Property(e => e.Status).HasMaxLength(30).IsRequired();
        b.Property(e => e.CurrentPayoutAmount).HasPrecision(18, 2).HasDefaultValue(0);
        b.Property(e => e.RowVersion).IsConcurrencyToken();
        b.HasIndex(e => new { e.CampaignId, e.CreatorProfileId }).IsUnique();
        b.HasIndex(e => e.Status);

        b.HasOne(e => e.TrackingTag).WithOne(t => t.Assignment)
            .HasForeignKey<TrackingTag>(t => t.AssignmentId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(e => e.Submissions).WithOne(s => s.Assignment)
            .HasForeignKey(s => s.AssignmentId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class TrackingTagConfiguration : IEntityTypeConfiguration<TrackingTag>
{
    public void Configure(EntityTypeBuilder<TrackingTag> b)
    {
        b.ToTable("tracking_tags");
        b.HasKey(e => e.Id);
        b.Property(e => e.TagCode).HasMaxLength(100).IsRequired();
        b.Property(e => e.RecommendedHashtag).HasMaxLength(100);
        b.HasIndex(e => e.TagCode).IsUnique();
        b.HasIndex(e => e.AssignmentId).IsUnique();
    }
}
