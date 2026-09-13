using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Ugc;

/// <summary>Tunable limits for the marketplace's creator rules.</summary>
public sealed record UgcVerificationThresholds(int StrikesToSuspend = 3)
{
    public static readonly UgcVerificationThresholds Default = new(3);
}

/// <summary>
/// The first filter a creator meets, and the strike rule that can remove them.
/// Pure so the rules can be tuned and tested without a database.
/// </summary>
public static class UgcVerificationRule
{
    /// <summary>
    /// Verified as soon as a sample video exists. A brand buys a finished video,
    /// so the creator's platform and follower count are not a gate — TikTok is
    /// optional and only adds numbers the brand can see. Never promotes past
    /// Verified (Approved is an admin's call) and never touches a Suspended creator.
    /// </summary>
    public static UgcCreatorStatus Evaluate(UgcCreatorStatus current, bool hasSampleVideo)
    {
        if (current is UgcCreatorStatus.Suspended or UgcCreatorStatus.Approved) return current;
        return hasSampleVideo ? UgcCreatorStatus.Verified : UgcCreatorStatus.Pending;
    }

    /// <summary>Likes across recent videos over followers. Zero followers → zero, never a division error.</summary>
    public static decimal LikeFollowerRatio(long totalLikes, int followers)
        => followers <= 0 ? 0m : Math.Round((decimal)totalLikes / followers, 4);

    public static bool ShouldSuspend(int strikes, UgcVerificationThresholds thresholds)
        => strikes >= thresholds.StrikesToSuspend;

    /// <summary>May this creator take paid work? Product exchange is open to anyone Approved/Verified.</summary>
    public static bool CanApply(UgcCreatorStatus status, UgcCompensationType compensation,
        bool payoutOnboardingComplete, bool hasFTax, bool requireFTaxForPaid)
    {
        if (status is not (UgcCreatorStatus.Verified or UgcCreatorStatus.Approved)) return false;
        if (compensation == UgcCompensationType.ProductExchange) return true;
        if (!payoutOnboardingComplete) return false;
        if (requireFTaxForPaid && !hasFTax) return false;
        return true;
    }
}
