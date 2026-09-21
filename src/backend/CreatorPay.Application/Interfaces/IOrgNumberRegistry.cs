namespace CreatorPay.Application.Interfaces;

/// <summary>Outcome of a registry lookup for a Swedish organisation number.</summary>
public record OrgRegistryResult(bool Found, string? RegisteredName, string Source, string? Error = null);

/// <summary>
/// Confirms that an organisation number belongs to a registered company.
/// The default implementation asks the EU VIES service (momsregistret).
/// A lookup failure (network, VIES down) is reported as Found=false with an
/// Error, and the brand simply stays unverified until the next attempt.
/// </summary>
public interface IOrgNumberRegistry
{
    Task<OrgRegistryResult> LookupAsync(string tenDigitOrgNumber, CancellationToken ct = default);
}
