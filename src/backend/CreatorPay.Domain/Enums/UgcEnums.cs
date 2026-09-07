namespace CreatorPay.Domain.Enums;

// ═══════════════════════════════════════════════════════════════════
// UGC-marknadsplatsen ("Beställ video"): fasta leveranser med kontrakt
// och pengar i escrow — skilt från kranen/kampanjerna som betalar per view.
// ═══════════════════════════════════════════════════════════════════

/// <summary>Where a creator stands in the UGC marketplace, on top of their ordinary Vyrle account.</summary>
public enum UgcCreatorStatus
{
    /// <summary>Onboarded, waiting for the automatic filter or an admin.</summary>
    Pending = 0,
    /// <summary>Passed the automatic filter (followers, like/follower ratio, sample video).</summary>
    Verified = 1,
    /// <summary>Cleared by an admin — may apply to campaigns and be invited.</summary>
    Approved = 2,
    /// <summary>Locked out: three strikes or an admin decision.</summary>
    Suspended = 3,
}

public enum UgcCompensationType
{
    Paid = 0,
    ProductExchange = 1,
    PaidPlusProduct = 2,
}

/// <summary>Drives both the contract text and the price.</summary>
public enum UgcRightsPackage
{
    /// <summary>Brand's own organic channels, unlimited time. Creator keeps copyright.</summary>
    Organic = 0,
    /// <summary>Organic + paid advertising for 6 months.</summary>
    OrganicPlusAds6M = 1,
    /// <summary>Organic + paid advertising for 12 months.</summary>
    OrganicPlusAds12M = 2,
    /// <summary>Full transfer of rights.</summary>
    FullTransfer = 3,
}

public enum UgcCampaignStatus { Draft = 0, Published = 1, Closed = 2 }

public enum UgcApplicationStatus
{
    Applied = 0,
    Preselected = 1,
    Hired = 2,
    Rejected = 3,
    Withdrawn = 4,
}

/// <summary>
/// The collab's life. Every move between these is an explicit, validated
/// transition in <see cref="Ugc.UgcCollabStateMachine"/> — never a free write.
/// </summary>
public enum UgcCollabStatus
{
    /// <summary>Created at hire or direct invite; awaiting brand funding + creator acceptance.</summary>
    Invited = 0,
    /// <summary>Both parties accepted the contract and (for paid work) money is held.</summary>
    Accepted = 1,
    InProgress = 2,
    /// <summary>A deliverable is uploaded; the auto-approve clock is running.</summary>
    Submitted = 3,
    RevisionRequested = 4,
    /// <summary>Brand (or the clock) approved; transfer to the creator is in flight.</summary>
    Approved = 5,
    /// <summary>Terminal: creator paid (or product-exchange settled), license issued.</summary>
    Paid = 6,
    /// <summary>Terminal: withdrawn, declined, no-show or refunded after dispute.</summary>
    Cancelled = 7,
    /// <summary>Frozen pending an admin decision.</summary>
    Disputed = 8,
}

public enum UgcPaymentStatus
{
    /// <summary>Row exists, nothing charged yet.</summary>
    Pending = 0,
    /// <summary>Brand charged; funds held on the platform account.</summary>
    Held = 1,
    /// <summary>Creator's share transferred.</summary>
    Transferred = 2,
    Refunded = 3,
    /// <summary>Dispute split: part transferred, part refunded.</summary>
    PartiallyRefunded = 4,
    Failed = 5,
    /// <summary>Product exchange — no money moves.</summary>
    NotApplicable = 6,
}

public enum UgcDisputeStatus { Open = 0, Resolved = 1 }

public enum UgcDisputeDecision { PayCreator = 0, RefundBrand = 1, Split = 2 }

/// <summary>Who performs a transition. The machine refuses moves the actor is not allowed to make.</summary>
public enum UgcActor { Brand = 0, Creator = 1, Admin = 2, System = 3 }
