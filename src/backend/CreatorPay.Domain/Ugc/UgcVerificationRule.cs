using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Ugc;

/// <summary>Tunable limits for the marketplace's creator rules.</summary>
public sealed record UgcVerificationThresholds(int StrikesToSuspend = 3)
{
    public static readonly UgcVerificationThresholds Default = new(3);
}

/// <summary>
/// Who may take work, and the strike rule that can remove them. Pure so the
/// rules can be tuned and tested without a database.
///
/// A creator starts out Verified: the account was already approved by VYRLE
/// at sign-up, and a brand buys a finished video, so neither platform nor
/// follower count is a gate. The real verification is the Stripe onboarding
/// (identity + bank account), which is required for paid work. Pending is
/// reserved for creators an admin has pulled in for review.
/// </summary>
public static class UgcVerificationRule
{
    /// <summary>Likes across recent videos over followers. Zero followers → zero, never a division error.</summary>
    public static decimal LikeFollowerRatio(long totalLikes, int followers)
        => followers <= 0 ? 0m : Math.Round((decimal)totalLikes / followers, 4);

    public static bool ShouldSuspend(int strikes, UgcVerificationThresholds thresholds)
        => strikes >= thresholds.StrikesToSuspend;

    /// <summary>
    /// May this creator take the work? Anyone Verified/Approved may. The Stripe
    /// verification is optional and only matters when money is paid out: an
    /// approved job waits for it, it never stops an application.
    /// </summary>
    public static bool CanApply(UgcCreatorStatus status, UgcCompensationType compensation,
        bool payoutOnboardingComplete, bool hasFTax, bool requireFTaxForPaid)
    {
        _ = payoutOnboardingComplete;
        if (status is not (UgcCreatorStatus.Verified or UgcCreatorStatus.Approved)) return false;
        if (compensation == UgcCompensationType.ProductExchange) return true;
        if (requireFTaxForPaid && !hasFTax) return false;
        return true;
    }
}
