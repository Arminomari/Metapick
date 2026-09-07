using CreatorPay.Domain.Common;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Entities;

// ═══════════════════════════════════════════════════════════════════
// UGC-marknadsplatsen — "Beställ video"
//
// Ett företag beställer korta UGC-videor till fast pris. Pengarna hålls
// tills leveransen är godkänd, kontraktet genereras från mall, och varje
// statusbyte går genom UgcCollabStateMachine. Alla belopp är öre (long).
//
// Modulen är medvetet skild från Campaign/CreatorCampaignAssignment
// (kranen och kampanjerna, som betalar per verifierad view).
// ═══════════════════════════════════════════════════════════════════

/// <summary>
/// The creator's standing in the marketplace — a 1:1 extension of the ordinary
/// <see cref="CreatorProfile"/>. Vyrle already has creators with onboarding,
/// selfie, TikTok OAuth and a portfolio; this adds only what the marketplace needs.
/// </summary>
public class UgcCreatorProfile : BaseEntity
{
    public Guid CreatorProfileId { get; set; }

    public UgcCreatorStatus Status { get; set; } = UgcCreatorStatus.Pending;
    public string? StatusNote { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    /// <summary>No-shows. Three → <see cref="UgcCreatorStatus.Suspended"/>.</summary>
    public int Strikes { get; set; }
    public DateTime? SuspendedAt { get; set; }

    // ── Marketplace profile ─────────────────────────────
    public string[] Categories { get; set; } = [];
    public string? City { get; set; }
    public string? Region { get; set; }
    public string[] Languages { get; set; } = ["sv"];
    /// <summary>The one sample video required at onboarding.</summary>
    public string? SampleVideoUrl { get; set; }

    // ── Social snapshot used by the automatic filter ────
    public int FollowerSnapshot { get; set; }
    /// <summary>Likes across recent videos divided by followers — engagement, not vanity.</summary>
    public decimal LikeFollowerRatio { get; set; }
    public DateTime? SocialSnapshotAt { get; set; }

    // ── Track record (denormalised, updated on transitions) ──
    public int DeliveredCount { get; set; }
    public int OnTimeCount { get; set; }
    public int LateCount { get; set; }
    public decimal AverageRating { get; set; }
    public int RatingCount { get; set; }

    // ── Payout & tax ────────────────────────────────────
    public string? StripeConnectAccountId { get; set; }
    public bool PayoutOnboardingComplete { get; set; }
    /// <summary>Godkänd för F-skatt.</summary>
    public bool HasFTax { get; set; }
    public bool VatRegistered { get; set; }
    public string? VatNumber { get; set; }

    /// <summary>Non-exclusive licence for Vyrle to show delivered work in portfolio/marketing. Creator may opt out.</summary>
    public bool AllowPortfolioUse { get; set; } = true;

    // Navigation
    public CreatorProfile CreatorProfile { get; set; } = null!;
}

/// <summary>A brand's order: structured brief, targeting, money and rights.</summary>
public class UgcCampaign : SoftDeletableEntity
{
    public Guid BrandProfileId { get; set; }
    public string Title { get; set; } = null!;

    // ── Brief (structured so AI can fill it and contracts can quote it) ──
    public string Goal { get; set; } = null!;
    /// <summary>e.g. "9:16 vertikal, TikTok/Reels".</summary>
    public string Format { get; set; } = null!;
    public int LengthSeconds { get; set; }
    public int VideoCount { get; set; } = 1;
    public string[] Hooks { get; set; } = [];
    public string CallToAction { get; set; } = null!;
    public string[] ReferenceUrls { get; set; } = [];
    public string[] Dos { get; set; } = [];
    public string[] Donts { get; set; } = [];
    public string? ExtraNotes { get; set; }
    public bool BriefGeneratedByAi { get; set; }

    // ── Targeting ───────────────────────────────────────
    public string? Region { get; set; }
    public string[] Categories { get; set; } = [];
    public int? MinFollowers { get; set; }
    public int? MaxFollowers { get; set; }

    // ── Money & rights ──────────────────────────────────
    public UgcCompensationType Compensation { get; set; } = UgcCompensationType.Paid;
    /// <summary>Per video, in öre. Creators bid inside this range.</summary>
    public long BudgetMinOre { get; set; }
    public long BudgetMaxOre { get; set; }
    public string? ProductDescription { get; set; }
    public long? ProductValueOre { get; set; }
    public UgcRightsPackage RightsPackage { get; set; } = UgcRightsPackage.Organic;

    /// <summary>Days from the creator's acceptance to delivery.</summary>
    public int DeadlineDays { get; set; } = 7;
    /// <summary>How many creators the brand wants to hire.</summary>
    public int Slots { get; set; } = 1;

    public UgcCampaignStatus Status { get; set; } = UgcCampaignStatus.Draft;
    public DateTime? PublishedAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    // Navigation
    public BrandProfile BrandProfile { get; set; } = null!;
    public ICollection<UgcApplication> Applications { get; set; } = new List<UgcApplication>();
    public ICollection<UgcCollab> Collabs { get; set; } = new List<UgcCollab>();
}

/// <summary>A creator's bid on a published campaign.</summary>
public class UgcApplication : BaseEntity
{
    public Guid CampaignId { get; set; }
    public Guid CreatorProfileId { get; set; }

    /// <summary>Per video, in öre. Must sit inside the campaign's budget range.</summary>
    public long BidOre { get; set; }
    public string Pitch { get; set; } = null!;

    public UgcApplicationStatus Status { get; set; } = UgcApplicationStatus.Applied;
    public DateTime? DecidedAt { get; set; }
    public string? DecisionNote { get; set; }

    // Navigation
    public UgcCampaign Campaign { get; set; } = null!;
    public CreatorProfile CreatorProfile { get; set; } = null!;
}

/// <summary>
/// The engagement itself — created at hire or direct invite. Carries a frozen
/// copy of the brief and the generated contract so later edits to the campaign
/// never change what was agreed.
/// </summary>
public class UgcCollab : BaseEntity
{
    /// <summary>Null for a direct invite from the catalogue.</summary>
    public Guid? CampaignId { get; set; }
    public Guid? ApplicationId { get; set; }
    public Guid BrandProfileId { get; set; }
    public Guid CreatorProfileId { get; set; }

    public string Title { get; set; } = null!;
    /// <summary>Brief as agreed, rendered to text at hire.</summary>
    public string BriefSnapshot { get; set; } = null!;

    // ── Money (öre) ─────────────────────────────────────
    public UgcCompensationType Compensation { get; set; }
    /// <summary>What the creator receives.</summary>
    public long AgreedAmountOre { get; set; }
    /// <summary>Vyrle's fee on top, paid by the brand.</summary>
    public long PlatformFeeOre { get; set; }
    /// <summary>AgreedAmountOre + PlatformFeeOre.</summary>
    public long BrandTotalOre { get; set; }
    public decimal FeePercentApplied { get; set; }
    public string? ProductDescription { get; set; }
    public long? ProductValueOre { get; set; }

    public UgcRightsPackage RightsPackage { get; set; }

    // ── Time ────────────────────────────────────────────
    public int DeadlineDays { get; set; }
    /// <summary>Set when the creator accepts; moved forward on each revision round.</summary>
    public DateTime? DeadlineAt { get; set; }
    public DateTime? AutoApproveAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
    /// <summary>True when the cancellation was a missed deadline — the strike case.</summary>
    public bool NoShow { get; set; }

    // ── Contract ────────────────────────────────────────
    public string ContractText { get; set; } = null!;
    /// <summary>SHA-256 of ContractText — what both parties actually accepted.</summary>
    public string ContractHash { get; set; } = null!;
    public string ContractTemplateVersion { get; set; } = null!;
    public DateTime? BrandAcceptedAt { get; set; }
    public DateTime? CreatorAcceptedAt { get; set; }

    // ── State ───────────────────────────────────────────
    public UgcCollabStatus Status { get; set; } = UgcCollabStatus.Invited;
    public int RevisionCount { get; set; }
    public int MaxRevisions { get; set; } = 2;

    // ── Idempotent reminder markers (jobs re-run safely) ──
    public DateTime? DeadlineReminder48hSentAt { get; set; }
    public DateTime? DeadlineReminder24hSentAt { get; set; }
    public DateTime? AutoApproveReminderSentAt { get; set; }

    /// <summary>Licence certificate (PDF) issued at payment.</summary>
    public string? LicenseDocumentUrl { get; set; }
    /// <summary>Brand's rating of the delivery, 1–5, set after approval.</summary>
    public int? BrandRating { get; set; }

    // Navigation
    public UgcCampaign? Campaign { get; set; }
    public UgcApplication? Application { get; set; }
    public BrandProfile BrandProfile { get; set; } = null!;
    public CreatorProfile CreatorProfile { get; set; } = null!;
    public UgcPayment? Payment { get; set; }
    public UgcDispute? Dispute { get; set; }
    public ICollection<UgcDeliverable> Deliverables { get; set; } = new List<UgcDeliverable>();
    public ICollection<UgcMessage> Messages { get; set; } = new List<UgcMessage>();
    public ICollection<UgcCollabEvent> Events { get; set; } = new List<UgcCollabEvent>();
}

/// <summary>One uploaded version of the video. Revisions add versions; nothing is overwritten.</summary>
public class UgcDeliverable : BaseEntity
{
    public Guid CollabId { get; set; }
    public int Version { get; set; } = 1;

    public string FileUrl { get; set; } = null!;
    /// <summary>Storage key (object storage) — null while files live on local disk.</summary>
    public string? FileKey { get; set; }
    public long FileSizeBytes { get; set; }
    public string ContentType { get; set; } = "video/mp4";
    public int? DurationSeconds { get; set; }

    public string? CreatorComment { get; set; }
    public string? BrandFeedback { get; set; }
    public DateTime? FeedbackAt { get; set; }

    // Navigation
    public UgcCollab Collab { get; set; } = null!;
}

/// <summary>
/// The money trail for one collab. Stripe-shaped (PaymentIntent → hold,
/// Transfer → creator, Refund → brand) but provider-agnostic in the model.
/// Card data never lives here.
/// </summary>
public class UgcPayment : BaseEntity
{
    public Guid CollabId { get; set; }
    public string Provider { get; set; } = "stripe";
    public string Currency { get; set; } = "SEK";

    public string? PaymentIntentId { get; set; }
    public string? ChargeId { get; set; }
    public string? TransferId { get; set; }
    public string? RefundId { get; set; }

    public UgcPaymentStatus Status { get; set; } = UgcPaymentStatus.Pending;

    public long BrandPaidOre { get; set; }
    public long CreatorAmountOre { get; set; }
    public long PlatformFeeOre { get; set; }
    public long TransferredOre { get; set; }
    public long RefundedOre { get; set; }

    public DateTime? HeldAt { get; set; }
    public DateTime? TransferredAt { get; set; }
    public DateTime? RefundedAt { get; set; }
    public string? LastError { get; set; }

    // Navigation
    public UgcCollab Collab { get; set; } = null!;
}

/// <summary>Every provider webhook we have seen — the idempotency ledger. Same event id twice = no-op.</summary>
public class UgcWebhookEvent : BaseEntity
{
    public string Provider { get; set; } = "stripe";
    public string EventId { get; set; } = null!;
    public string EventType { get; set; } = null!;
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Opened by either side after submission. Freezes auto-approve. The admin
/// answers exactly one question — does the delivery follow the brief? — and
/// the decision moves the money.
/// </summary>
public class UgcDispute : BaseEntity
{
    public Guid CollabId { get; set; }
    public Guid OpenedByUserId { get; set; }
    public UgcActor OpenedBy { get; set; }
    public string Reason { get; set; } = null!;

    public UgcDisputeStatus Status { get; set; } = UgcDisputeStatus.Open;
    public UgcDisputeDecision? Decision { get; set; }
    /// <summary>For <see cref="UgcDisputeDecision.Split"/>: creator's share of the agreed amount.</summary>
    public int? CreatorSharePercent { get; set; }
    public string? AdminReasoning { get; set; }
    public Guid? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }

    // Navigation
    public UgcCollab Collab { get; set; } = null!;
}

/// <summary>One thread per collab.</summary>
public class UgcMessage : BaseEntity
{
    public Guid CollabId { get; set; }
    public Guid SenderUserId { get; set; }
    public UgcActor SenderRole { get; set; }
    public string Body { get; set; } = null!;
    public string? AttachmentUrl { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }

    // Navigation
    public UgcCollab Collab { get; set; } = null!;
}

/// <summary>Audit trail: every transition, who made it and why.</summary>
public class UgcCollabEvent : BaseEntity
{
    public Guid CollabId { get; set; }
    public UgcCollabStatus? FromStatus { get; set; }
    public UgcCollabStatus ToStatus { get; set; }
    public UgcActor Actor { get; set; }
    public Guid? ActorUserId { get; set; }
    public string? Note { get; set; }

    // Navigation
    public UgcCollab Collab { get; set; } = null!;
}
