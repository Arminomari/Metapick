using CreatorPay.Domain.Entities;

namespace CreatorPay.Domain.Common;

/// <summary>
/// The one definition of "verified TikTok connection": an active OAuth
/// connection that holds a token. A handle typed at registration creates an
/// account row with Scopes = "manual" and no token; it proves nothing and must
/// never be shown to brands as connected or verified.
/// </summary>
public static class TikTokAccountExtensions
{
    public const string ManualScope = "manual";

    public static bool IsVerified(this TikTokAccount? a)
        => a is { IsActive: true } && a.Scopes != ManualScope && !string.IsNullOrEmpty(a.AccessTokenEncrypted);

    /// <summary>Follower count that may be shown to brands: only from a verified connection.</summary>
    public static int VerifiedFollowers(this TikTokAccount? a)
        => a.IsVerified() ? a!.FollowerCount : 0;

    /// <summary>When the follower figure was last refreshed from TikTok; null when unverified.</summary>
    public static DateTime? FollowersSyncedAt(this TikTokAccount? a)
        => a.IsVerified() ? (a!.LastSyncAt ?? a.ConnectedAt) : null;
}
