using CreatorPay.Application.Ugc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Stripe;
using Stripe.Checkout;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// Stripe Connect, "separate charges and transfers": the brand pays the
/// platform account through hosted Checkout, the creator's share is
/// transferred from that charge at approval, refunds go back to the brand.
/// Every mutating call carries an idempotency key derived from the collab, so
/// a retried request can never charge, pay or refund twice.
/// Activated when Stripe:SecretKey is set.
/// </summary>
public sealed class StripeUgcPaymentGateway : IUgcPaymentGateway
{
    private readonly StripeClient _client;
    private readonly ILogger<StripeUgcPaymentGateway> _logger;

    public StripeUgcPaymentGateway(IConfiguration config, ILogger<StripeUgcPaymentGateway> logger)
    {
        _client = new StripeClient(config["Stripe:SecretKey"]);
        _logger = logger;
    }

    public bool IsConfigured => true;

    public async Task<UgcGatewayResult> CreateCheckoutAsync(UgcCheckoutRequest r, CancellationToken ct = default)
    {
        try
        {
            var options = new SessionCreateOptions
            {
                Mode = "payment",
                SuccessUrl = r.SuccessUrl,
                CancelUrl = r.CancelUrl,
                CustomerEmail = r.CustomerEmail,
                ClientReferenceId = r.CollabId.ToString(),
                ExpiresAt = DateTime.UtcNow.AddHours(23),
                LineItems =
                [
                    new SessionLineItemOptions
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = r.Currency.ToLowerInvariant(),
                            UnitAmount = r.BrandTotalOre,
                            ProductData = new SessionLineItemPriceDataProductDataOptions { Name = r.Description },
                        },
                    },
                ],
                PaymentIntentData = new SessionPaymentIntentDataOptions
                {
                    TransferGroup = r.CollabId.ToString(),
                    Description = r.Description,
                    Metadata = new Dictionary<string, string> { ["collabId"] = r.CollabId.ToString() },
                },
                Metadata = new Dictionary<string, string> { ["collabId"] = r.CollabId.ToString() },
            };
            var session = await new SessionService(_client).CreateAsync(options,
                new RequestOptions { IdempotencyKey = $"ugc-checkout-{r.CollabId}-{DateTime.UtcNow:yyyyMMddHH}" }, ct);
            return UgcGatewayResult.Ok(session.Id, session.Url);
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe checkout failed for collab {Id}", r.CollabId);
            return UgcGatewayResult.Fail($"Stripe: {ex.StripeError?.Message ?? ex.Message}");
        }
    }

    public async Task<UgcGatewayResult> TransferAsync(Guid collabId, string chargeId, long amountOre, string currency, string connectedAccountId, CancellationToken ct = default)
    {
        try
        {
            var transfer = await new TransferService(_client).CreateAsync(new TransferCreateOptions
            {
                Amount = amountOre,
                Currency = currency.ToLowerInvariant(),
                Destination = connectedAccountId,
                SourceTransaction = chargeId,
                TransferGroup = collabId.ToString(),
                Metadata = new Dictionary<string, string> { ["collabId"] = collabId.ToString() },
            }, new RequestOptions { IdempotencyKey = $"ugc-transfer-{collabId}-{amountOre}" }, ct);
            return UgcGatewayResult.Ok(transfer.Id);
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe transfer failed for collab {Id}", collabId);
            return UgcGatewayResult.Fail($"Stripe: {ex.StripeError?.Message ?? ex.Message}");
        }
    }

    public async Task<UgcGatewayResult> RefundAsync(Guid collabId, string paymentIntentId, long amountOre, CancellationToken ct = default)
    {
        try
        {
            var refund = await new RefundService(_client).CreateAsync(new RefundCreateOptions
            {
                PaymentIntent = paymentIntentId,
                Amount = amountOre,
                Metadata = new Dictionary<string, string> { ["collabId"] = collabId.ToString() },
            }, new RequestOptions { IdempotencyKey = $"ugc-refund-{collabId}-{paymentIntentId}-{amountOre}" }, ct);
            return UgcGatewayResult.Ok(refund.Id);
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe refund failed for collab {Id}", collabId);
            return UgcGatewayResult.Fail($"Stripe: {ex.StripeError?.Message ?? ex.Message}");
        }
    }

    public async Task<UgcGatewayResult> CreateConnectOnboardingAsync(Guid creatorProfileId, string? existingAccountId, string email, string returnUrl, string refreshUrl, CancellationToken ct = default)
    {
        try
        {
            var accountId = existingAccountId;
            if (string.IsNullOrEmpty(accountId))
            {
                var account = await new AccountService(_client).CreateAsync(new AccountCreateOptions
                {
                    Type = "express",
                    Country = "SE",
                    Email = email,
                    BusinessType = "individual",
                    Capabilities = new AccountCapabilitiesOptions
                    {
                        Transfers = new AccountCapabilitiesTransfersOptions { Requested = true },
                    },
                    Metadata = new Dictionary<string, string> { ["creatorProfileId"] = creatorProfileId.ToString() },
                }, new RequestOptions { IdempotencyKey = $"ugc-account-{creatorProfileId}" }, ct);
                accountId = account.Id;
            }

            var link = await new AccountLinkService(_client).CreateAsync(new AccountLinkCreateOptions
            {
                Account = accountId,
                ReturnUrl = returnUrl,
                RefreshUrl = refreshUrl,
                Type = "account_onboarding",
            }, cancellationToken: ct);
            return UgcGatewayResult.Ok(accountId, link.Url);
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe Connect onboarding failed for creator {Id}", creatorProfileId);
            return UgcGatewayResult.Fail($"Stripe: {ex.StripeError?.Message ?? ex.Message}");
        }
    }

    public async Task<UgcConnectStatus> GetConnectStatusAsync(string connectedAccountId, CancellationToken ct = default)
    {
        try
        {
            var a = await new AccountService(_client).GetAsync(connectedAccountId, cancellationToken: ct);
            return new UgcConnectStatus(true, a.DetailsSubmitted, a.PayoutsEnabled, a.ChargesEnabled, a.Requirements?.DisabledReason);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Stripe account lookup failed for {Id}", connectedAccountId);
            return new UgcConnectStatus(false, false, false, false, ex.StripeError?.Message ?? ex.Message);
        }
    }
}

/// <summary>What a Stripe webhook boils down to, once verified and unpacked.</summary>
public sealed record StripeWebhookEvent(
    string Id, string Type,
    Guid? CollabId, string? PaymentIntentId, string? ChargeId, long AmountOre, string? CheckoutSessionId,
    long RefundedOre, string? RefundId,
    string? AccountId, bool DetailsSubmitted, bool PayoutsEnabled);

/// <summary>
/// Verifies the signature and extracts the few facts the marketplace acts on.
/// Keeps Stripe's types out of the Application layer.
/// </summary>
public sealed class StripeWebhookParser
{
    private readonly string? _secret;
    private readonly StripeClient? _client;

    public StripeWebhookParser(IConfiguration config)
    {
        _secret = config["Stripe:WebhookSecret"];
        var key = config["Stripe:SecretKey"];
        _client = string.IsNullOrEmpty(key) ? null : new StripeClient(key);
    }

    public bool IsConfigured => !string.IsNullOrEmpty(_secret);

    public async Task<StripeWebhookEvent> ParseAsync(string json, string signatureHeader, CancellationToken ct = default)
    {
        var evt = EventUtility.ConstructEvent(json, signatureHeader, _secret, throwOnApiVersionMismatch: false);

        switch (evt.Data.Object)
        {
            case Session s when evt.Type == "checkout.session.completed":
            {
                var collabId = Parse(s.ClientReferenceId) ?? Parse(s.Metadata?.GetValueOrDefault("collabId"));
                string? chargeId = null;
                if (s.PaymentIntentId != null && _client != null)
                {
                    try
                    {
                        var pi = await new PaymentIntentService(_client).GetAsync(s.PaymentIntentId, cancellationToken: ct);
                        chargeId = pi.LatestChargeId;
                    }
                    catch (StripeException) { /* the payment_intent.succeeded event carries it too */ }
                }
                var paid = s.PaymentStatus == "paid";
                return new StripeWebhookEvent(evt.Id, evt.Type, paid ? collabId : null, s.PaymentIntentId, chargeId, s.AmountTotal ?? 0, s.Id, 0, null, null, false, false);
            }
            case PaymentIntent pi when evt.Type == "payment_intent.succeeded":
                return new StripeWebhookEvent(evt.Id, evt.Type, Parse(pi.Metadata?.GetValueOrDefault("collabId")), pi.Id, pi.LatestChargeId, pi.AmountReceived, null, 0, null, null, false, false);

            case Charge c when evt.Type == "charge.refunded":
                return new StripeWebhookEvent(evt.Id, evt.Type, Parse(c.Metadata?.GetValueOrDefault("collabId")), c.PaymentIntentId, c.Id, c.Amount, null, c.AmountRefunded, c.Refunds?.Data?.FirstOrDefault()?.Id, null, false, false);

            case Account a when evt.Type == "account.updated":
                return new StripeWebhookEvent(evt.Id, evt.Type, null, null, null, 0, null, 0, null, a.Id, a.DetailsSubmitted, a.PayoutsEnabled);

            default:
                return new StripeWebhookEvent(evt.Id, evt.Type, null, null, null, 0, null, 0, null, null, false, false);
        }
    }

    private static Guid? Parse(string? s) => Guid.TryParse(s, out var g) ? g : null;
}
