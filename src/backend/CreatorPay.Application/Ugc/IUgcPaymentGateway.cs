namespace CreatorPay.Application.Ugc;

/// <summary>
/// Everything the marketplace ever asks a payment provider to do. Implemented
/// with Stripe Connect (separate charges and transfers); until the keys exist
/// <see cref="UnconfiguredUgcPaymentGateway"/> answers honestly that it cannot,
/// and the flow stops at "betalning ej konfigurerad" instead of pretending.
/// </summary>
public interface IUgcPaymentGateway
{
    bool IsConfigured { get; }

    /// <summary>
    /// Hosted checkout for the brand: the full amount (creator + fee) lands on
    /// the platform account. Returns the URL to send the brand to and the
    /// session id. The money is "held" once the webhook confirms payment.
    /// </summary>
    Task<UgcGatewayResult> CreateCheckoutAsync(UgcCheckoutRequest request, CancellationToken ct = default);

    /// <summary>Move the creator's share from the held charge to their connected account.</summary>
    Task<UgcGatewayResult> TransferAsync(Guid collabId, string chargeId, long amountOre, string currency, string connectedAccountId, CancellationToken ct = default);

    /// <summary>Give (part of) the held amount back to the brand.</summary>
    Task<UgcGatewayResult> RefundAsync(Guid collabId, string paymentIntentId, long amountOre, CancellationToken ct = default);

    /// <summary>Create (or reuse) an Express account for the creator and return the onboarding link.</summary>
    Task<UgcGatewayResult> CreateConnectOnboardingAsync(Guid creatorProfileId, string? existingAccountId, string email, string returnUrl, string refreshUrl, CancellationToken ct = default);

    /// <summary>Is the connected account ready to receive transfers?</summary>
    Task<UgcConnectStatus> GetConnectStatusAsync(string connectedAccountId, CancellationToken ct = default);
}

public sealed record UgcCheckoutRequest(
    Guid CollabId, long BrandTotalOre, string Currency, string CustomerEmail,
    string Description, string SuccessUrl, string CancelUrl);

public sealed record UgcGatewayResult(bool Success, string? ExternalId, string? Error, string? Url = null)
{
    public static UgcGatewayResult Ok(string externalId, string? url = null) => new(true, externalId, null, url);
    public static UgcGatewayResult Fail(string error) => new(false, null, error);
}

public sealed record UgcConnectStatus(bool Exists, bool DetailsSubmitted, bool PayoutsEnabled, bool ChargesEnabled, string? DisabledReason)
{
    public bool Ready => Exists && DetailsSubmitted && PayoutsEnabled;
}

/// <summary>No provider yet. Every call fails with a readable reason; nothing is pretended.</summary>
public sealed class UnconfiguredUgcPaymentGateway : IUgcPaymentGateway
{
    public const string Message = "Betalningar är inte aktiverade ännu (Stripe-nycklar saknas).";

    public bool IsConfigured => false;

    public Task<UgcGatewayResult> CreateCheckoutAsync(UgcCheckoutRequest request, CancellationToken ct = default)
        => Task.FromResult(UgcGatewayResult.Fail(Message));

    public Task<UgcGatewayResult> TransferAsync(Guid collabId, string chargeId, long amountOre, string currency, string connectedAccountId, CancellationToken ct = default)
        => Task.FromResult(UgcGatewayResult.Fail(Message));

    public Task<UgcGatewayResult> RefundAsync(Guid collabId, string paymentIntentId, long amountOre, CancellationToken ct = default)
        => Task.FromResult(UgcGatewayResult.Fail(Message));

    public Task<UgcGatewayResult> CreateConnectOnboardingAsync(Guid creatorProfileId, string? existingAccountId, string email, string returnUrl, string refreshUrl, CancellationToken ct = default)
        => Task.FromResult(UgcGatewayResult.Fail(Message));

    public Task<UgcConnectStatus> GetConnectStatusAsync(string connectedAccountId, CancellationToken ct = default)
        => Task.FromResult(new UgcConnectStatus(false, false, false, false, Message));
}

/// <summary>AI brief generation — implemented with the Anthropic SDK in Infrastructure.</summary>
public interface IUgcBriefGenerator
{
    bool IsConfigured { get; }
    Task<UgcBriefDto> GenerateAsync(UgcBriefContext context, CancellationToken ct = default);
}

public sealed record UgcBriefContext(
    string CompanyName, string? Industry, string? Description, string? Website,
    string? Goal, string? ProductOrService, string? Audience, string? Tone, string? Extra);

public sealed class UnconfiguredUgcBriefGenerator : IUgcBriefGenerator
{
    public bool IsConfigured => false;
    public Task<UgcBriefDto> GenerateAsync(UgcBriefContext context, CancellationToken ct = default)
        => throw new InvalidOperationException("AI-brief är inte aktiverad ännu (Anthropic-nyckel saknas).");
}
