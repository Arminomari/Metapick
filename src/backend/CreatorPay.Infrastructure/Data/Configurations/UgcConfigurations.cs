using System.Text.Json;
using CreatorPay.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CreatorPay.Infrastructure.Data.Configurations;

/// <summary>string[] ↔ JSON text, same shape as ProfileTags/ContentTags on the core entities.</summary>
internal static class UgcArrayColumn
{
    public static PropertyBuilder<string[]> AsJson(this PropertyBuilder<string[]> b) =>
        b.HasColumnType("text")
         .HasConversion(
             v => JsonSerializer.Serialize(v ?? Array.Empty<string>(), (JsonSerializerOptions?)null),
             v => string.IsNullOrEmpty(v) ? Array.Empty<string>() : (JsonSerializer.Deserialize<string[]>(v, (JsonSerializerOptions?)null) ?? Array.Empty<string>()));
}

public class UgcCreatorProfileConfiguration : IEntityTypeConfiguration<UgcCreatorProfile>
{
    public void Configure(EntityTypeBuilder<UgcCreatorProfile> b)
    {
        b.ToTable("ugc_creator_profiles");
        b.HasKey(e => e.Id);
        b.HasIndex(e => e.CreatorProfileId).IsUnique();
        b.HasIndex(e => e.Status);
        b.Property(e => e.StatusNote).HasMaxLength(1000);
        b.Property(e => e.City).HasMaxLength(100);
        b.Property(e => e.Region).HasMaxLength(100);
        b.Property(e => e.SampleVideoUrl).HasMaxLength(2000);
        b.Property(e => e.StripeConnectAccountId).HasMaxLength(100);
        b.Property(e => e.VatNumber).HasMaxLength(40);
        b.Property(e => e.LikeFollowerRatio).HasPrecision(10, 4);
        b.Property(e => e.AverageRating).HasPrecision(4, 2);
        b.Property(e => e.Categories).AsJson();
        b.Property(e => e.Languages).AsJson();

        b.HasOne(e => e.CreatorProfile)
            .WithOne()
            .HasForeignKey<UgcCreatorProfile>(e => e.CreatorProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UgcCampaignConfiguration : IEntityTypeConfiguration<UgcCampaign>
{
    public void Configure(EntityTypeBuilder<UgcCampaign> b)
    {
        b.ToTable("ugc_campaigns");
        b.HasKey(e => e.Id);
        b.HasQueryFilter(e => !e.IsDeleted);
        b.HasIndex(e => new { e.BrandProfileId, e.Status });
        b.HasIndex(e => new { e.Status, e.PublishedAt });
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Goal).HasMaxLength(2000).IsRequired();
        b.Property(e => e.Format).HasMaxLength(200).IsRequired();
        b.Property(e => e.CallToAction).HasMaxLength(500).IsRequired();
        b.Property(e => e.ExtraNotes).HasMaxLength(4000);
        b.Property(e => e.Region).HasMaxLength(100);
        b.Property(e => e.ProductDescription).HasMaxLength(1000);
        b.Property(e => e.Hooks).AsJson();
        b.Property(e => e.ReferenceUrls).AsJson();
        b.Property(e => e.Dos).AsJson();
        b.Property(e => e.Donts).AsJson();
        b.Property(e => e.Categories).AsJson();

        b.HasOne(e => e.BrandProfile)
            .WithMany()
            .HasForeignKey(e => e.BrandProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UgcApplicationConfiguration : IEntityTypeConfiguration<UgcApplication>
{
    public void Configure(EntityTypeBuilder<UgcApplication> b)
    {
        b.ToTable("ugc_applications");
        b.HasKey(e => e.Id);
        // One bid per creator per campaign.
        b.HasIndex(e => new { e.CampaignId, e.CreatorProfileId }).IsUnique();
        b.HasIndex(e => new { e.CreatorProfileId, e.Status });
        b.Property(e => e.Pitch).HasMaxLength(2000).IsRequired();
        b.Property(e => e.DecisionNote).HasMaxLength(1000);

        b.HasOne(e => e.Campaign)
            .WithMany(c => c.Applications)
            .HasForeignKey(e => e.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.CreatorProfile)
            .WithMany()
            .HasForeignKey(e => e.CreatorProfileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UgcCollabConfiguration : IEntityTypeConfiguration<UgcCollab>
{
    public void Configure(EntityTypeBuilder<UgcCollab> b)
    {
        b.ToTable("ugc_collabs");
        b.HasKey(e => e.Id);
        b.HasIndex(e => new { e.BrandProfileId, e.Status });
        b.HasIndex(e => new { e.CreatorProfileId, e.Status });
        // The jobs' two questions: who is late, who is silent.
        b.HasIndex(e => new { e.Status, e.DeadlineAt });
        b.HasIndex(e => new { e.Status, e.AutoApproveAt });
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.BriefSnapshot).IsRequired();
        b.Property(e => e.ContractText).IsRequired();
        b.Property(e => e.ContractHash).HasMaxLength(64).IsRequired();
        b.Property(e => e.ContractTemplateVersion).HasMaxLength(40).IsRequired();
        b.Property(e => e.CancelReason).HasMaxLength(1000);
        b.Property(e => e.ProductDescription).HasMaxLength(1000);
        b.Property(e => e.LicenseDocumentUrl).HasMaxLength(2000);
        b.Property(e => e.FeePercentApplied).HasPrecision(5, 2);

        b.HasOne(e => e.Campaign)
            .WithMany(c => c.Collabs)
            .HasForeignKey(e => e.CampaignId)
            .OnDelete(DeleteBehavior.SetNull);
        b.HasOne(e => e.Application)
            .WithMany()
            .HasForeignKey(e => e.ApplicationId)
            .OnDelete(DeleteBehavior.SetNull);
        b.HasOne(e => e.BrandProfile)
            .WithMany()
            .HasForeignKey(e => e.BrandProfileId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.CreatorProfile)
            .WithMany()
            .HasForeignKey(e => e.CreatorProfileId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class UgcDeliverableConfiguration : IEntityTypeConfiguration<UgcDeliverable>
{
    public void Configure(EntityTypeBuilder<UgcDeliverable> b)
    {
        b.ToTable("ugc_deliverables");
        b.HasKey(e => e.Id);
        b.HasIndex(e => new { e.CollabId, e.Version }).IsUnique();
        b.Property(e => e.FileUrl).HasMaxLength(2000).IsRequired();
        b.Property(e => e.FileKey).HasMaxLength(500);
        b.Property(e => e.ContentType).HasMaxLength(100);
        b.Property(e => e.CreatorComment).HasMaxLength(2000);
        b.Property(e => e.BrandFeedback).HasMaxLength(4000);

        b.HasOne(e => e.Collab)
            .WithMany(c => c.Deliverables)
            .HasForeignKey(e => e.CollabId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UgcPaymentConfiguration : IEntityTypeConfiguration<UgcPayment>
{
    public void Configure(EntityTypeBuilder<UgcPayment> b)
    {
        b.ToTable("ugc_payments");
        b.HasKey(e => e.Id);
        b.HasIndex(e => e.CollabId).IsUnique();
        b.HasIndex(e => e.PaymentIntentId);
        b.Property(e => e.Provider).HasMaxLength(40);
        b.Property(e => e.Currency).HasMaxLength(3);
        b.Property(e => e.PaymentIntentId).HasMaxLength(100);
        b.Property(e => e.ChargeId).HasMaxLength(100);
        b.Property(e => e.TransferId).HasMaxLength(100);
        b.Property(e => e.RefundId).HasMaxLength(100);
        b.Property(e => e.LastError).HasMaxLength(1000);

        b.HasOne(e => e.Collab)
            .WithOne(c => c.Payment)
            .HasForeignKey<UgcPayment>(e => e.CollabId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UgcWebhookEventConfiguration : IEntityTypeConfiguration<UgcWebhookEvent>
{
    public void Configure(EntityTypeBuilder<UgcWebhookEvent> b)
    {
        b.ToTable("ugc_webhook_events");
        b.HasKey(e => e.Id);
        // The idempotency guarantee lives in this index.
        b.HasIndex(e => new { e.Provider, e.EventId }).IsUnique();
        b.Property(e => e.Provider).HasMaxLength(40);
        b.Property(e => e.EventId).HasMaxLength(200).IsRequired();
        b.Property(e => e.EventType).HasMaxLength(100).IsRequired();
        b.Property(e => e.Error).HasMaxLength(2000);
    }
}

public class UgcDisputeConfiguration : IEntityTypeConfiguration<UgcDispute>
{
    public void Configure(EntityTypeBuilder<UgcDispute> b)
    {
        b.ToTable("ugc_disputes");
        b.HasKey(e => e.Id);
        b.HasIndex(e => e.CollabId).IsUnique();
        b.HasIndex(e => e.Status);
        b.Property(e => e.Reason).HasMaxLength(4000).IsRequired();
        b.Property(e => e.AdminReasoning).HasMaxLength(4000);

        b.HasOne(e => e.Collab)
            .WithOne(c => c.Dispute)
            .HasForeignKey<UgcDispute>(e => e.CollabId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UgcMessageConfiguration : IEntityTypeConfiguration<UgcMessage>
{
    public void Configure(EntityTypeBuilder<UgcMessage> b)
    {
        b.ToTable("ugc_messages");
        b.HasKey(e => e.Id);
        b.HasIndex(e => new { e.CollabId, e.CreatedAt });
        b.Property(e => e.Body).HasMaxLength(4000).IsRequired();
        b.Property(e => e.AttachmentUrl).HasMaxLength(2000);

        b.HasOne(e => e.Collab)
            .WithMany(c => c.Messages)
            .HasForeignKey(e => e.CollabId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UgcCollabEventConfiguration : IEntityTypeConfiguration<UgcCollabEvent>
{
    public void Configure(EntityTypeBuilder<UgcCollabEvent> b)
    {
        b.ToTable("ugc_collab_events");
        b.HasKey(e => e.Id);
        b.HasIndex(e => new { e.CollabId, e.CreatedAt });
        b.Property(e => e.Note).HasMaxLength(1000);

        b.HasOne(e => e.Collab)
            .WithMany(c => c.Events)
            .HasForeignKey(e => e.CollabId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
