using CreatorPay.Domain.Common;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Entities;

public class CreatorSubmission : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public string TikTokVideoUrl { get; set; } = null!;
    public string? TikTokVideoId { get; set; }
    public string? Notes { get; set; }
    public SubmissionStatus Status { get; set; } = SubmissionStatus.Pending;
    public string? RejectionReason { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public CreatorCampaignAssignment Assignment { get; set; } = null!;
    public SocialPost? SocialPost { get; set; }
}

public class SocialPost : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Guid? SubmissionId { get; set; }
    public string TikTokVideoId { get; set; } = null!;
    public string TikTokUrl { get; set; } = null!;
    public string? Caption { get; set; }
    public int? Duration { get; set; }
    public DateTime PublishedAt { get; set; }
    public decimal MatchConfidence { get; set; }
    public string? MatchDetails { get; set; } // JSON
    public VerificationStatus VerificationStatus { get; set; } = VerificationStatus.Pending;
    public long LatestViewCount { get; set; }
    public long LatestLikeCount { get; set; }
    public long LatestCommentCount { get; set; }
    public long LatestShareCount { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime DiscoveredAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public CreatorCampaignAssignment Assignment { get; set; } = null!;
    public CreatorSubmission? Submission { get; set; }
    public ICollection<SocialPostMetricSnapshot> MetricSnapshots { get; set; } = new List<SocialPostMetricSnapshot>();
    public ICollection<ViewVerificationRecord> VerificationRecords { get; set; } = new List<ViewVerificationRecord>();
}

public class SocialPostMetricSnapshot : BaseEntity
{
    public Guid SocialPostId { get; set; }
    public long ViewCount { get; set; }
    public long LikeCount { get; set; }
    public long CommentCount { get; set; }
    public long ShareCount { get; set; }
    public DateOnly SnapshotDate { get; set; }
    public MetricSource Source { get; set; } = MetricSource.ApiAutomatic;

    public SocialPost SocialPost { get; set; } = null!;
}

public class ViewVerificationRecord : BaseEntity
{
    public Guid SocialPostId { get; set; }
    public long VerifiedViewCount { get; set; }
    public long PeakViewCount { get; set; }
    public VerificationMethod VerificationMethod { get; set; }
    public decimal ConfidenceScore { get; set; }
    public string? Flags { get; set; }
    public DateTime VerifiedAt { get; set; } = DateTime.UtcNow;
    public Guid? VerifiedBy { get; set; }
    public string? Notes { get; set; }

    public SocialPost SocialPost { get; set; } = null!;
}
