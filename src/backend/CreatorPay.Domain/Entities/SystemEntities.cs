using CreatorPay.Domain.Common;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Entities;

public class FraudFlag : BaseEntity
{
    public FraudEntityType EntityType { get; set; }
    public Guid EntityId { get; set; }
    public FraudType FlagType { get; set; }
    public FraudSeverity Severity { get; set; } = FraudSeverity.Medium;
    public string Description { get; set; } = null!;
    public string? Evidence { get; set; } // JSON
    public FraudStatus Status { get; set; } = FraudStatus.Open;
    public Guid? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? Resolution { get; set; }
}

public class AuditLog : BaseEntity
{
    public Guid? UserId { get; set; }
    public string Action { get; set; } = null!;
    public string? EntityType { get; set; }
    public Guid? EntityId { get; set; }
    public string? OldValues { get; set; } // JSON
    public string? NewValues { get; set; } // JSON
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    public User? User { get; set; }
}

public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }

    public User User { get; set; } = null!;
}

public class Dispute : BaseEntity
{
    public Guid CampaignId { get; set; }
    public Guid? AssignmentId { get; set; }
    public Guid InitiatedById { get; set; }
    public DisputeType Type { get; set; }
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public DisputeStatus Status { get; set; } = DisputeStatus.Open;
    public string? Resolution { get; set; }
    public Guid? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }

    // Navigation
    public Campaign Campaign { get; set; } = null!;
    public CreatorCampaignAssignment? Assignment { get; set; }
    public User InitiatedBy { get; set; } = null!;
}
