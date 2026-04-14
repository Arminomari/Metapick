using CreatorPay.Domain.Common;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Entities;

public class User : SoftDeletableEntity
{
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public UserRole Role { get; set; }
    public UserStatus Status { get; set; } = UserStatus.PendingVerification;
    public bool EmailVerified { get; set; }
    public string? RefreshTokenHash { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }
    public DateTime? LastLoginAt { get; set; }

    // Navigation
    public AdminProfile? AdminProfile { get; set; }
    public BrandProfile? BrandProfile { get; set; }
    public CreatorProfile? CreatorProfile { get; set; }
}

public class AdminProfile : BaseEntity
{
    public Guid UserId { get; set; }
    public string? Department { get; set; }
    public AdminLevel PermissionLevel { get; set; } = AdminLevel.Moderator;

    public User User { get; set; } = null!;
}

public class BrandProfile : SoftDeletableEntity
{
    public Guid UserId { get; set; }
    public string CompanyName { get; set; } = null!;
    public string? OrganizationNumber { get; set; }
    public string? Website { get; set; }
    public string Industry { get; set; } = null!;
    public string Country { get; set; } = null!;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string? ContactPhone { get; set; }
    public BrandStatus Status { get; set; } = BrandStatus.Pending;
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public BrandWallet? Wallet { get; set; }
    public ICollection<Campaign> Campaigns { get; set; } = new List<Campaign>();
}

public class CreatorProfile : SoftDeletableEntity
{
    public Guid UserId { get; set; }
    public string DisplayName { get; set; } = null!;
    public string? Bio { get; set; }
    public string Category { get; set; } = null!;
    public string Country { get; set; } = null!;
    public string Language { get; set; } = "sv";
    public string? AvatarUrl { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public int FollowerCount { get; set; }
    public int? AverageViews { get; set; }
    public CreatorStatus Status { get; set; } = CreatorStatus.Pending;
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }
    public string? PayoutMethod { get; set; }
    public string? PayoutDetailsEncrypted { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public TikTokAccount? TikTokAccount { get; set; }
    public ICollection<CampaignApplication> Applications { get; set; } = new List<CampaignApplication>();
    public ICollection<CreatorCampaignAssignment> Assignments { get; set; } = new List<CreatorCampaignAssignment>();
    public ICollection<PayoutRequest> PayoutRequests { get; set; } = new List<PayoutRequest>();
}

public class TikTokAccount : BaseEntity
{
    public Guid CreatorProfileId { get; set; }
    public string TikTokUserId { get; set; } = null!;
    public string TikTokUsername { get; set; } = null!;
    public string? DisplayName { get; set; }
    public int FollowerCount { get; set; }
    public string? AvatarUrl { get; set; }
    public string AccessTokenEncrypted { get; set; } = null!;
    public string RefreshTokenEncrypted { get; set; } = null!;
    public DateTime TokenExpiresAt { get; set; }
    public string Scopes { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSyncAt { get; set; }

    // Navigation
    public CreatorProfile CreatorProfile { get; set; } = null!;
}
