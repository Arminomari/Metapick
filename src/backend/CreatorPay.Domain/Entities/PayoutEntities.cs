using CreatorPay.Domain.Common;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Entities;

public class PayoutCalculation : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public decimal CalculatedAmount { get; set; }
    public long VerifiedViews { get; set; }
    public Guid PayoutRuleId { get; set; }
    public string CalculationDetails { get; set; } = null!; // JSON
    public PayoutCalculationStatus Status { get; set; } = PayoutCalculationStatus.Preliminary;
    public bool IsLatest { get; set; } = true;
    public DateTime CalculatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LockedAt { get; set; }
    public Guid? LockedBy { get; set; }
    public decimal? OverriddenAmount { get; set; }
    public string? OverrideReason { get; set; }

    // Navigation
    public CreatorCampaignAssignment Assignment { get; set; } = null!;
    public PayoutRule PayoutRule { get; set; } = null!;
    public PayoutRequest? PayoutRequest { get; set; }
}

public class PayoutRequest : BaseEntity
{
    public Guid CreatorProfileId { get; set; }
    public Guid PayoutCalculationId { get; set; }
    public decimal RequestedAmount { get; set; }
    public string Currency { get; set; } = "SEK";
    public string PayoutMethod { get; set; } = null!;
    public string PayoutDetailsEncrypted { get; set; } = null!;
    public PayoutStatus Status { get; set; } = PayoutStatus.Pending;
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }

    // Navigation
    public CreatorProfile CreatorProfile { get; set; } = null!;
    public PayoutCalculation PayoutCalculation { get; set; } = null!;
    public ICollection<PayoutTransaction> Transactions { get; set; } = new List<PayoutTransaction>();
}

public class PayoutTransaction : BaseEntity
{
    public Guid PayoutRequestId { get; set; }
    public string? ExternalTransactionId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "SEK";
    public string Provider { get; set; } = null!;
    public TransactionStatus Status { get; set; } = TransactionStatus.Initiated;
    public string? FailureReason { get; set; }
    public DateTime InitiatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public PayoutRequest PayoutRequest { get; set; } = null!;
}

public class BrandWallet : BaseEntity
{
    public Guid BrandProfileId { get; set; }
    public decimal Balance { get; set; }
    public decimal TotalDeposited { get; set; }
    public decimal TotalSpent { get; set; }
    public decimal TotalReserved { get; set; }
    public string Currency { get; set; } = "SEK";
    public int RowVersion { get; set; }

    public BrandProfile BrandProfile { get; set; } = null!;
}
