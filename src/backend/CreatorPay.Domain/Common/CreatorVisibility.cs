using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Common;

/// <summary>
/// When a creator profile is shown to brands. Approval alone is not enough:
/// without an OAuth TikTok connection nothing on the profile can be verified,
/// so the profile stays private until the account is connected.
/// </summary>
public static class CreatorVisibility
{
    public static bool IsVisibleToBrands(CreatorStatus status, bool tikTokVerified)
        => status == CreatorStatus.Approved && tikTokVerified;

    /// <summary>Why the profile is hidden, for the creator's own screen. Null when visible.</summary>
    public static string? Blocker(CreatorStatus status, bool tikTokVerified) => status switch
    {
        CreatorStatus.Pending => "Kontot granskas av VYRLE. Du får ett mejl när det är godkänt.",
        CreatorStatus.Rejected => "Kontot är inte godkänt.",
        CreatorStatus.Suspended => "Kontot är avstängt.",
        _ when !tikTokVerified => "Koppla ditt TikTok-konto via TikTok-inloggningen så blir profilen synlig för företag och dina views kan verifieras.",
        _ => null,
    };
}
