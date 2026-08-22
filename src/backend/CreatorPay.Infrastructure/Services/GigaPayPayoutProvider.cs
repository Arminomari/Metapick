using System.Net.Http.Json;
using System.Text.Json.Serialization;
using CreatorPay.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// GigaPay payout provider (https://developer.gigapay.se). GigaPay acts as the
/// employer of record: we create a payout for a GigaPay employee and they
/// handle taxes, fees and the actual bank transfer.
///
/// Activated by configuring GigaPay:ApiKey + GigaPay:IntegrationId
/// (env: GigaPay__ApiKey / GigaPay__IntegrationId). Optional GigaPay:BaseUrl
/// overrides the production URL — use https://api.demo.gigapay.se/v2/ to test.
///
/// NOTE: settlement currently passes our PayoutRequest id as recipient
/// reference. Before real money can flow, creators must be onboarded as
/// GigaPay employees (POST /employees/) and the settlement job must pass that
/// employee id — until then GigaPay rejects the payout and the transaction
/// stays unsettled, which is the safe failure mode.
/// </summary>
public class GigaPayPayoutProvider : IPayoutProvider
{
    private readonly HttpClient _http;
    private readonly ILogger<GigaPayPayoutProvider> _logger;

    public GigaPayPayoutProvider(HttpClient http, IConfiguration config, ILogger<GigaPayPayoutProvider> logger)
    {
        _http = http;
        _logger = logger;
        var baseUrl = config["GigaPay:BaseUrl"] ?? "https://api.gigapay.se/v2/";
        _http.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/");
        _http.DefaultRequestHeaders.Add("Authorization", $"Token {config["GigaPay:ApiKey"]}");
        _http.DefaultRequestHeaders.Add("Integration-ID", config["GigaPay:IntegrationId"]);
    }

    public string ProviderName => "GigaPay";

    public async Task<PayoutProviderResult> InitiatePayoutAsync(decimal amount, string currency, string recipientDetails)
    {
        try
        {
            // `id` doubles as an idempotency key: retrying settlement for the
            // same payout request can never create a duplicate transfer.
            var payload = new GigaPayPayoutRequest(
                Id: recipientDetails,
                Employee: recipientDetails,
                Amount: amount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture),
                Currency: currency,
                Description: "VYRLE creator-utbetalning");

            var response = await _http.PostAsJsonAsync("payouts/", payload);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("GigaPay payout rejected ({Status}): {Body}", (int)response.StatusCode, body);
                return new PayoutProviderResult(false, null, $"GigaPay {(int)response.StatusCode}: {body}");
            }

            var created = await response.Content.ReadFromJsonAsync<GigaPayPayoutResponse>();
            _logger.LogInformation("GigaPay payout created: {Id}", created?.Id);
            return new PayoutProviderResult(true, created?.Id, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GigaPay payout failed");
            return new PayoutProviderResult(false, null, ex.Message);
        }
    }

    public async Task<PayoutProviderStatus> CheckStatusAsync(string externalTransactionId)
    {
        try
        {
            var payout = await _http.GetFromJsonAsync<GigaPayPayoutResponse>($"payouts/{externalTransactionId}/");
            if (payout == null)
                return new PayoutProviderStatus("unknown", null, "Not found at GigaPay");
            return payout.CompletedAt != null
                ? new PayoutProviderStatus("completed", payout.CompletedAt, null)
                : new PayoutProviderStatus("pending", null, null);
        }
        catch (Exception ex)
        {
            return new PayoutProviderStatus("unknown", null, ex.Message);
        }
    }

    private sealed record GigaPayPayoutRequest(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("employee")] string Employee,
        [property: JsonPropertyName("amount")] string Amount,
        [property: JsonPropertyName("currency")] string Currency,
        [property: JsonPropertyName("description")] string Description);

    private sealed record GigaPayPayoutResponse(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("completed_at")] DateTime? CompletedAt);
}
