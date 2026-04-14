using CreatorPay.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CreatorPay.Infrastructure.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users");
        b.HasKey(e => e.Id);
        b.Property(e => e.Email).HasMaxLength(256).IsRequired();
        b.HasIndex(e => e.Email).IsUnique();
        b.Property(e => e.PasswordHash).HasMaxLength(512).IsRequired();
        b.Property(e => e.Role).HasMaxLength(20).IsRequired();
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.IsDeleted).HasDefaultValue(false);

        b.HasOne(e => e.AdminProfile).WithOne(p => p.User)
            .HasForeignKey<AdminProfile>(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.BrandProfile).WithOne(p => p.User)
            .HasForeignKey<BrandProfile>(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.CreatorProfile).WithOne(p => p.User)
            .HasForeignKey<CreatorProfile>(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AdminProfileConfiguration : IEntityTypeConfiguration<AdminProfile>
{
    public void Configure(EntityTypeBuilder<AdminProfile> b)
    {
        b.ToTable("admin_profiles");
        b.HasKey(e => e.Id);
        b.Property(e => e.Department).HasMaxLength(200);
        b.HasIndex(e => e.UserId).IsUnique();
    }
}

public class BrandProfileConfiguration : IEntityTypeConfiguration<BrandProfile>
{
    public void Configure(EntityTypeBuilder<BrandProfile> b)
    {
        b.ToTable("brand_profiles");
        b.HasKey(e => e.Id);
        b.Property(e => e.CompanyName).HasMaxLength(200).IsRequired();
        b.Property(e => e.OrganizationNumber).HasMaxLength(50);
        b.Property(e => e.ContactPhone).HasMaxLength(30);
        b.Property(e => e.Website).HasMaxLength(500);
        b.Property(e => e.LogoUrl).HasMaxLength(1000);
        b.Property(e => e.Status).HasMaxLength(30).IsRequired();
        b.Property(e => e.IsDeleted).HasDefaultValue(false);
        b.HasIndex(e => e.UserId).IsUnique();

        b.HasMany(e => e.Campaigns).WithOne(c => c.BrandProfile)
            .HasForeignKey(c => c.BrandProfileId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(e => e.Wallet).WithOne(w => w.BrandProfile)
            .HasForeignKey<BrandWallet>(w => w.BrandProfileId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CreatorProfileConfiguration : IEntityTypeConfiguration<CreatorProfile>
{
    public void Configure(EntityTypeBuilder<CreatorProfile> b)
    {
        b.ToTable("creator_profiles");
        b.HasKey(e => e.Id);
        b.Property(e => e.DisplayName).HasMaxLength(100).IsRequired();
        b.Property(e => e.Bio).HasMaxLength(2000);
        b.Property(e => e.Country).HasMaxLength(2).IsRequired();
        b.Property(e => e.Language).HasMaxLength(5);
        b.Property(e => e.AvatarUrl).HasMaxLength(1000);
        b.Property(e => e.Status).HasMaxLength(20).IsRequired();
        b.Property(e => e.IsDeleted).HasDefaultValue(false);
        b.HasIndex(e => e.UserId).IsUnique();

        b.HasOne(e => e.TikTokAccount).WithOne(t => t.CreatorProfile)
            .HasForeignKey<TikTokAccount>(t => t.CreatorProfileId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(e => e.Applications).WithOne(a => a.CreatorProfile)
            .HasForeignKey(a => a.CreatorProfileId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(e => e.Assignments).WithOne(a => a.CreatorProfile)
            .HasForeignKey(a => a.CreatorProfileId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class TikTokAccountConfiguration : IEntityTypeConfiguration<TikTokAccount>
{
    public void Configure(EntityTypeBuilder<TikTokAccount> b)
    {
        b.ToTable("tiktok_accounts");
        b.HasKey(e => e.Id);
        b.Property(e => e.TikTokUserId).HasMaxLength(100);
        b.Property(e => e.TikTokUsername).HasMaxLength(100).IsRequired();
        b.Property(e => e.DisplayName).HasMaxLength(200);
        b.Property(e => e.AccessTokenEncrypted).HasMaxLength(2000);
        b.Property(e => e.RefreshTokenEncrypted).HasMaxLength(2000);
        b.HasIndex(e => e.CreatorProfileId).IsUnique();
        b.HasIndex(e => e.TikTokUsername).IsUnique();
    }
}
