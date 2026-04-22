using CreatorPay.Domain.Common;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Entities;

public class Campaign : SoftDeletableEntity
{
    public Guid BrandProfileId { get; set; }
    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string? TargetAudience { get; set; }
    public string Country { get; set; } = null!;
    public string? Region { get; set; }
    public string Category { get; set; } = null!;
    public string RequiredHashtag { get; set; } = null!;
    public string? ContentInstructions { get; set; }
    public string? ForbiddenContent { get; set; }
    public int MinViews { get; set; }
    public int? MaxViews { get; set; }
    public PayoutModel PayoutModel { get; set; }
    public decimal Budget { get; set; }
    public decimal BudgetSpent { get; set; }
    public decimal BudgetReserved { get; set; }
    public int MaxCreators { get; set; } = 10;
    public int RequiredVideoCount { get; set; } = 1;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public CampaignStatus Status { get; set; } = CampaignStatus.Draft;
    public ModerationStatus ModerationStatus { get; set; } = ModerationStatus.Pending;
    public ReviewMode ReviewMode { get; set; } = ReviewMode.ManualReview;
    public string? CoverImageUrl { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int RowVersion { get; set; }
    /// <summary>Free-text description of perks/benefits creators receive (discount codes, PR packages, etc.)</summary>
    public string? Perks { get; set; }
    /// <summary>Content-type tags the brand is looking for, e.g. ["TikTok Video","Instagram Reels"]</summary>
    public string[] ContentTags { get; set; } = [];

    // Navigation
    public BrandProfile BrandProfile { get; set; } = null!;
    public ICollection<CampaignRequirement> Requirements { get; set; } = new List<CampaignRequirement>();
    public ICollection<CampaignRule> Rules { get; set; } = new List<CampaignRule>();
    public ICollection<PayoutRule> PayoutRules { get; set; } = new List<PayoutRule>();
    public ICollection<CampaignApplication> Applications { get; set; } = new List<CampaignApplication>();
    public ICollection<CreatorCampaignAssignment> Assignments { get; set; } = new List<CreatorCampaignAssignment>();
}

public class CampaignRequirement : BaseEntity
{
    public Guid CampaignId { get; set; }
    public RequirementType RequirementType { get; set; }
    public string Value { get; set; } = null!;
    public bool IsRequired { get; set; } = true;

    public Campaign Campaign { get; set; } = null!;
}

public class CampaignRule : BaseEntity
{
    public Guid CampaignId { get; set; }
    public RuleType RuleType { get; set; }
    public string Description { get; set; } = null!;
    public bool IsMandatory { get; set; } = true;

    public Campaign Campaign { get; set; } = null!;
}

public class PayoutRule : BaseEntity
{
    public Guid CampaignId { get; set; }
    public PayoutType PayoutType { get; set; }
    public long MinViews { get; set; }
    public long? MaxViews { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "SEK";
    public decimal? MaxPayoutPerCreator { get; set; }
    public int SortOrder { get; set; }

    public Campaign Campaign { get; set; } = null!;
}

public class CampaignApplication : BaseEntity
{
    public Guid CampaignId { get; set; }
    public Guid CreatorProfileId { get; set; }
    public string? Message { get; set; }
    public ApplicationStatus Status { get; set; } = ApplicationStatus.Pending;
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }

    // Navigation
    public Campaign Campaign { get; set; } = null!;
    public CreatorProfile CreatorProfile { get; set; } = null!;
    public CreatorCampaignAssignment? Assignment { get; set; }
}

public class CreatorCampaignAssignment : BaseEntity
{
    public Guid CampaignId { get; set; }
    public Guid CreatorProfileId { get; set; }
    public Guid ApplicationId { get; set; }
    public AssignmentStatus Status { get; set; } = AssignmentStatus.Active;
    public decimal ReservedBudget { get; set; }
    public long TotalVerifiedViews { get; set; }
    public decimal CurrentPayoutAmount { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public int RowVersion { get; set; }

    // Navigation
    public Campaign Campaign { get; set; } = null!;
    public CreatorProfile CreatorProfile { get; set; } = null!;
    public CampaignApplication Application { get; set; } = null!;
    public TrackingTag? TrackingTag { get; set; }
    public ICollection<CreatorSubmission> Submissions { get; set; } = new List<CreatorSubmission>();
    public ICollection<SocialPost> SocialPosts { get; set; } = new List<SocialPost>();
    public ICollection<PayoutCalculation> PayoutCalculations { get; set; } = new List<PayoutCalculation>();
}

public class TrackingTag : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public string TagCode { get; set; } = null!;
    public string RecommendedHashtag { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    public CreatorCampaignAssignment Assignment { get; set; } = null!;
}
