using CreatorPay.Domain.Common;

namespace CreatorPay.Domain.Entities;

/// <summary>A star review left after an assignment is completed. One per reviewer per assignment.</summary>
public class Review : BaseEntity
{
    public Guid AssignmentId { get; set; }
    /// <summary>User.Id of the person who wrote the review</summary>
    public Guid ReviewerId { get; set; }
    /// <summary>User.Id of the person being reviewed</summary>
    public Guid RevieweeId { get; set; }
    /// <summary>"Brand" or "Creator"</summary>
    public string ReviewerRole { get; set; } = null!;
    /// <summary>1–5 stars</summary>
    public int Stars { get; set; }
    public string? Comment { get; set; }

    // Navigation
    public CreatorCampaignAssignment Assignment { get; set; } = null!;
    public User Reviewer { get; set; } = null!;
    public User Reviewee { get; set; } = null!;
}

/// <summary>A single chat message within an assignment thread.</summary>
public class ChatMessage : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Guid SenderId { get; set; }
    /// <summary>"Brand" or "Creator"</summary>
    public string SenderRole { get; set; } = null!;
    public string Body { get; set; } = null!;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }

    // Navigation
    public CreatorCampaignAssignment Assignment { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
