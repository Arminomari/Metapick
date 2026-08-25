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
    /// <summary>Set for assignment threads; null for brand↔creator direct threads.</summary>
    public Guid? AssignmentId { get; set; }
    /// <summary>Direct thread participants (both set only when AssignmentId is null).</summary>
    public Guid? BrandProfileId { get; set; }
    public Guid? CreatorProfileId { get; set; }
    public Guid SenderId { get; set; }
    /// <summary>"Brand" or "Creator"</summary>
    public string SenderRole { get; set; } = null!;
    public string Body { get; set; } = null!;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }

    // Navigation
    public CreatorCampaignAssignment? Assignment { get; set; }
    public User Sender { get; set; } = null!;
}

/// <summary>
/// One message in the conversation between VYRLE's admins and a single user.
/// There is exactly one thread per user, so whichever admin picks it up sees
/// the whole history and the user only ever has one place to answer.
/// </summary>
public class SupportMessage : BaseEntity
{
    /// <summary>The user this thread belongs to — never an admin.</summary>
    public Guid UserId { get; set; }
    /// <summary>Who wrote it: the admin's user id, or UserId when the user replies.</summary>
    public Guid SenderId { get; set; }
    public bool FromAdmin { get; set; }
    public string Body { get; set; } = null!;
    /// <summary>Read by the other side.</summary>
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
