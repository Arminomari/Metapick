using CreatorPay.Domain.Common;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Entities;

/// <summary>
/// A single piece of work a creator showcases on their profile so brands can
/// judge their quality (a video, image, TikTok/Instagram post or external link).
/// </summary>
public class PortfolioItem : BaseEntity
{
    public Guid CreatorProfileId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public PortfolioMediaType MediaType { get; set; }
    /// <summary>The image/video URL, or the TikTok/Instagram post URL.</summary>
    public string MediaUrl { get; set; } = null!;
    public string? ThumbnailUrl { get; set; }
    public string? Category { get; set; }
    /// <summary>Brand/restaurant this work was made for (optional case-study label).</summary>
    public string? BrandName { get; set; }
    public long? Views { get; set; }
    public long? Likes { get; set; }
    public int SortOrder { get; set; }
    public bool IsFeatured { get; set; }

    // Navigation
    public CreatorProfile CreatorProfile { get; set; } = null!;
}

/// <summary>
/// A direct PR offer sent by a brand/restaurant to a specific creator
/// (e.g. "come try our menu and post about it"). The inverse of a campaign
/// application: the brand reaches out first.
/// </summary>
public class PrOffer : BaseEntity
{
    public Guid BrandProfileId { get; set; }
    public Guid CreatorProfileId { get; set; }
    /// <summary>Optional link to an existing campaign this offer relates to.</summary>
    public Guid? CampaignId { get; set; }

    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public PrOfferType OfferType { get; set; }
    public string Category { get; set; } = null!;

    /// <summary>Cash compensation, when applicable (Paid / Hybrid offers).</summary>
    public decimal? CompensationAmount { get; set; }
    public string Currency { get; set; } = "SEK";

    /// <summary>What the restaurant/brand offers in kind (the "PR-utbud").</summary>
    public string? ProductDescription { get; set; }
    public decimal? ProductValue { get; set; }

    public DateTime? Deadline { get; set; }

    public PrOfferStatus Status { get; set; } = PrOfferStatus.Sent;
    public string? ResponseMessage { get; set; }
    public DateTime? ViewedAt { get; set; }
    public DateTime? RespondedAt { get; set; }

    /// <summary>Set when an accepted offer is converted into an assignment.</summary>
    public Guid? CreatedAssignmentId { get; set; }

    // Navigation
    public BrandProfile BrandProfile { get; set; } = null!;
    public CreatorProfile CreatorProfile { get; set; } = null!;
    public Campaign? Campaign { get; set; }
}
