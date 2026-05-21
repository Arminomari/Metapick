using CreatorPay.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CreatorPay.Infrastructure.Data.Configurations;

public class PortfolioItemConfiguration : IEntityTypeConfiguration<PortfolioItem>
{
    public void Configure(EntityTypeBuilder<PortfolioItem> b)
    {
        b.ToTable("portfolio_items");
        b.HasKey(e => e.Id);
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Description).HasMaxLength(2000);
        b.Property(e => e.MediaType).HasMaxLength(20).IsRequired();
        b.Property(e => e.MediaUrl).HasMaxLength(2000).IsRequired();
        b.Property(e => e.ThumbnailUrl).HasMaxLength(2000);
        b.Property(e => e.Category).HasMaxLength(100);
        b.Property(e => e.BrandName).HasMaxLength(200);
        b.HasIndex(e => new { e.CreatorProfileId, e.SortOrder });
    }
}

public class PrOfferConfiguration : IEntityTypeConfiguration<PrOffer>
{
    public void Configure(EntityTypeBuilder<PrOffer> b)
    {
        b.ToTable("pr_offers");
        b.HasKey(e => e.Id);
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.Property(e => e.Message).HasMaxLength(4000).IsRequired();
        b.Property(e => e.OfferType).HasMaxLength(20).IsRequired();
        b.Property(e => e.Category).HasMaxLength(100).IsRequired();
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.Currency).HasMaxLength(5);
        b.Property(e => e.ProductDescription).HasMaxLength(2000);
        b.Property(e => e.ResponseMessage).HasMaxLength(2000);
        b.Property(e => e.CompensationAmount).HasPrecision(18, 2);
        b.Property(e => e.ProductValue).HasPrecision(18, 2);

        b.HasIndex(e => new { e.CreatorProfileId, e.Status });
        b.HasIndex(e => new { e.BrandProfileId, e.Status });
        b.HasIndex(e => e.Category);

        b.HasOne(e => e.BrandProfile).WithMany()
            .HasForeignKey(e => e.BrandProfileId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.CreatorProfile).WithMany(c => c.ReceivedPrOffers)
            .HasForeignKey(e => e.CreatorProfileId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Campaign).WithMany()
            .HasForeignKey(e => e.CampaignId).OnDelete(DeleteBehavior.SetNull);
    }
}
