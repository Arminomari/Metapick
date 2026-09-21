using System.Net.Http.Json;
using System.Text.Json.Serialization;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Common;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// EU VIES VAT-number check (https://ec.europa.eu/taxation_customs/vies).
/// A Swedish VAT number is SE + organisationsnummer + 01, so a "valid" answer
/// means the organisation number is registered for VAT with Skatteverket.
/// No API key needed. Free, rate-limited, occasionally down — callers treat a
/// failure as "not verified yet", never as "invalid".
/// </summary>
public class ViesOrgNumberRegistry : IOrgNumberRegistry
{
    private readonly HttpClient _http;
    private readonly ILogger<ViesOrgNumberRegistry> _logger;
    private const string Endpoint = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";

    public ViesOrgNumberRegistry(HttpClient http, ILogger<ViesOrgNumberRegistry> logger)
    {
        _http = http;
        _logger = logger;
        _http.Timeout = TimeSpan.FromSeconds(8);
    }

    public async Task<OrgRegistryResult> LookupAsync(string tenDigitOrgNumber, CancellationToken ct = default)
    {
        var vat = OrgNumber.ToVatNumber(tenDigitOrgNumber);
        if (vat == null) return new OrgRegistryResult(false, null, "Vies", "Ogiltigt organisationsnummer");

        try
        {
            using var res = await _http.PostAsJsonAsync(Endpoint, new { countryCode = "SE", vatNumber = vat }, ct);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("VIES returned {Status} for org number lookup", (int)res.StatusCode);
                return new OrgRegistryResult(false, null, "Vies", $"VIES svarade {(int)res.StatusCode}");
            }
            var body = await res.Content.ReadFromJsonAsync<ViesResponse>(cancellationToken: ct);
            if (body == null) return new OrgRegistryResult(false, null, "Vies", "Tomt svar från VIES");
            if (body.UserError is not null && body.UserError != "VALID" && body.UserError != "INVALID")
                return new OrgRegistryResult(false, null, "Vies", $"VIES: {body.UserError}");
            var name = string.IsNullOrWhiteSpace(body.Name) || body.Name == "---" ? null : body.Name.Trim();
            return new OrgRegistryResult(body.Valid, name, "Vies");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "VIES lookup failed");
            return new OrgRegistryResult(false, null, "Vies", "Registret kunde inte nås");
        }
    }

    private sealed record ViesResponse(
        [property: JsonPropertyName("valid")] bool Valid,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("userError")] string? UserError);
}

/// <summary>Used when registry lookups are disabled (tests, offline dev). Nothing ever verifies.</summary>
public class NullOrgNumberRegistry : IOrgNumberRegistry
{
    public Task<OrgRegistryResult> LookupAsync(string tenDigitOrgNumber, CancellationToken ct = default)
        => Task.FromResult(new OrgRegistryResult(false, null, "None", "Registeruppslag är avstängt"));
}
