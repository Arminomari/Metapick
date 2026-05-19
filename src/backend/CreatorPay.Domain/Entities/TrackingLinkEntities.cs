using CreatorPay.Domain.Common;

namespace CreatorPay.Domain.Entities;

public class TrackingLink : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Guid CampaignId { get; set; }
    public Guid CreatorProfileId { get; set; }
    public string Code { get; set; } = null!;
    public string TargetUrl { get; set; } = null!;
    public string? Label { get; set; }
    public bool IsActive { get; set; } = true;
    public long TotalClicks { get; set; }

    public CreatorCampaignAssignment Assignment { get; set; } = null!;
    public Campaign Campaign { get; set; } = null!;
    public CreatorProfile CreatorProfile { get; set; } = null!;
    public ICollection<LinkTrackingClick> Clicks { get; set; } = new List<LinkTrackingClick>();
}

public class LinkTrackingClick : BaseEntity
{
    public Guid TrackingLinkId { get; set; }
    public DateTime ClickedAt { get; set; } = DateTime.UtcNow;
    public string? Referrer { get; set; }
    public string? UserAgent { get; set; }
    public string? IpHash { get; set; }

    public TrackingLink TrackingLink { get; set; } = null!;
}
