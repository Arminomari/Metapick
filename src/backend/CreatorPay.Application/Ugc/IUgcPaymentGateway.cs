namespace CreatorPay.Application.Ugc;

/// <summary>
/// The four things the marketplace ever asks a payment provider to do. Phase 2
/// implements this with Stripe Connect (separate charges and transfers); until
/// then <see cref="UnconfiguredUgcPaymentGateway"/> answers honestly that it
/// cannot, and the state machine leaves the collab where it is.
/// </summary>
public interface IUgcPaymentGateway
{
    bool IsConfigured { get; }

    /// <summary>Charge the brand the full amount (creator + fee) onto the platform account. Money is now held.</summary>
    Task<UgcGatewayResult> HoldAsync(Guid collabId, long brandTotalOre, string currency, string brandUserEmail, CancellationToken ct = default);

    /// <summary>Move the creator's share to their connected account.</summary>
    Task<UgcGatewayResult> TransferAsync(Guid collabId, string chargeId, long amountOre, string currency, string connectedAccountId, CancellationToken ct = default);

    /// <summary>Give (part of) the held amount back to the brand.</summary>
    Task<UgcGatewayResult> RefundAsync(Guid collabId, string paymentIntentId, long amountOre, CancellationToken ct = default);

    /// <summary>Start Express onboarding for a creator; returns the URL to send them to.</summary>
    Task<UgcGatewayResult> CreateConnectOnboardingAsync(Guid creatorProfileId, string email, string returnUrl, string refreshUrl, CancellationToken ct = default);
}

public sealed record UgcGatewayResult(bool Success, string? ExternalId, string? Error, string? Url = null)
{
    public static UgcGatewayResult Ok(string externalId, string? url = null) => new(true, externalId, null, url);
    public static UgcGatewayResult Fail(string error) => new(false, null, error);
}

/// <summary>No provider yet. Every call fails with a readable reason; nothing is pretended.</summary>
public sealed class UnconfiguredUgcPaymentGateway : IUgcPaymentGateway
{
    private const string Msg = "Betalningsleverantören är inte konfigurerad (Stripe__SecretKey saknas).";

    public bool IsConfigured => false;

    public Task<UgcGatewayResult> HoldAsync(Guid collabId, long brandTotalOre, string currency, string brandUserEmail, CancellationToken ct = default)
        => Task.FromResult(UgcGatewayResult.Fail(Msg));

    public Task<UgcGatewayResult> TransferAsync(Guid collabId, string chargeId, long amountOre, string currency, string connectedAccountId, CancellationToken ct = default)
        => Task.FromResult(UgcGatewayResult.Fail(Msg));

    public Task<UgcGatewayResult> RefundAsync(Guid collabId, string paymentIntentId, long amountOre, CancellationToken ct = default)
        => Task.FromResult(UgcGatewayResult.Fail(Msg));

    public Task<UgcGatewayResult> CreateConnectOnboardingAsync(Guid creatorProfileId, string email, string returnUrl, string refreshUrl, CancellationToken ct = default)
        => Task.FromResult(UgcGatewayResult.Fail(Msg));
}
