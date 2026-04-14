namespace CreatorPay.Domain.Enums;

public enum UserRole { Admin = 0, Brand = 1, Creator = 2 }
public enum UserStatus { PendingVerification = 0, Active = 1, Suspended = 2, Deactivated = 3 }
public enum AdminLevel { SuperAdmin = 0, Moderator = 1, Support = 2 }
public enum BrandStatus { Pending = 0, Approved = 1, Rejected = 2, Suspended = 3 }
public enum CreatorStatus { Pending = 0, Approved = 1, Rejected = 2, Suspended = 3 }

public enum CampaignStatus
{
    Draft = 0, PendingReview = 1, Active = 2, Paused = 3,
    Completed = 4, Cancelled = 5, Expired = 6
}

public enum ModerationStatus { Pending = 0, Approved = 1, Rejected = 2, FlaggedForReview = 3 }
public enum ReviewMode { AutoApprove = 0, ManualReview = 1 }
public enum PayoutModel { Fixed = 0, Tiered = 1, CPM = 2, Hybrid = 3 }
public enum ApplicationStatus { Pending = 0, Approved = 1, Rejected = 2, Withdrawn = 3 }
public enum AssignmentStatus { Active = 0, Paused = 1, Completed = 2, Cancelled = 3, Disqualified = 4 }
public enum VerificationStatus { Pending = 0, Verified = 1, Rejected = 2, ManualReview = 3, Failed = 4 }
public enum SubmissionStatus { Pending = 0, Matched = 1, Rejected = 2, ManualReview = 3, Approved = 4 }

public enum PayoutType { FixedThreshold = 0, Tiered = 1, CPM = 2, BonusAboveThreshold = 3 }
public enum PayoutCalculationStatus { Preliminary = 0, Verified = 1, Locked = 2, Overridden = 3, Disputed = 4 }

public enum PayoutStatus
{
    Pending = 0, UnderReview = 1, Approved = 2, Processing = 3,
    Completed = 4, Rejected = 5, Failed = 6
}

public enum TransactionStatus { Initiated = 0, Processing = 1, Completed = 2, Failed = 3, Reversed = 4 }
public enum FraudEntityType { SocialPost = 0, CreatorProfile = 1, Campaign = 2 }

public enum FraudType
{
    SuspiciousViewGrowth = 0, DuplicateVideo = 1, AccountMismatch = 2,
    SpamContent = 3, BotActivity = 4, Other = 5
}

public enum FraudSeverity { Low = 0, Medium = 1, High = 2, Critical = 3 }
public enum FraudStatus { Open = 0, UnderReview = 1, Resolved_Legitimate = 2, Resolved_Fraud = 3, Dismissed = 4 }
public enum DisputeType { PayoutDisagreement = 0, ContentViolation = 1, ViewVerification = 2, Other = 3 }
public enum DisputeStatus { Open = 0, UnderReview = 1, WaitingForInfo = 2, Resolved = 3, Closed = 4 }

public enum NotificationType
{
    ApplicationApproved = 0, ApplicationRejected = 1, CampaignStarted = 2,
    CampaignCompleted = 3, PayoutReady = 4, PayoutCompleted = 5,
    FraudAlert = 6, SystemMessage = 7, BrandApproved = 8,
    CreatorApproved = 9, NewApplication = 10, VideoVerified = 11,
    SubmissionApproved = 12, SubmissionRejected = 13
}

public enum RequirementType { MinFollowers = 0, MinAvgViews = 1, Country = 2, Category = 3, Language = 4, AccountAge = 5 }
public enum RuleType { MustInclude = 0, MustNotInclude = 1, MinDuration = 2, MaxDuration = 3, Format = 4, Other = 5 }
public enum MetricSource { ApiAutomatic = 0, ManualEntry = 1, WebhookPush = 2 }
public enum VerificationMethod { Automatic = 0, ManualReview = 1, AdminOverride = 2 }
