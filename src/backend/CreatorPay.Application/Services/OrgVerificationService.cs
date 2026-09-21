using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Common;
using CreatorPay.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Services;

/// <summary>
/// The only code that may set <see cref="BrandProfile.OrgVerified"/>.
/// Order of checks: ten digits → Luhn → registry (VIES). A registry outage
/// leaves the brand unverified (or keeps an existing verification of the same
/// number); only an explicit "not registered" answer or a changed number
/// revokes it.
/// </summary>
public class OrgVerificationService
{
    private readonly IOrgNumberRegistry _registry;
    private readonly ILogger<OrgVerificationService> _logger;

    public OrgVerificationService(IOrgNumberRegistry registry, ILogger<OrgVerificationService> logger)
    {
        _registry = registry;
        _logger = logger;
    }

    public sealed record Outcome(bool Verified, string Message);

    /// <summary>Runs the checks against the brand's stored organisation number and updates the entity (not saved here).</summary>
    public async Task<Outcome> VerifyAsync(BrandProfile brand, bool numberChanged, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        brand.OrgVerificationCheckedAt = now;

        var digits = OrgNumber.Digits(brand.OrganizationNumber);
        if (digits == null || !OrgNumber.IsValid(digits))
        {
            Revoke(brand);
            return new Outcome(false, "Organisationsnumret är inte giltigt (kontrollsiffran stämmer inte).");
        }

        var result = await _registry.LookupAsync(digits, ct);
        if (result.Found)
        {
            brand.OrgVerified = true;
            brand.OrgVerifiedAt = now;
            brand.OrgVerifiedName = result.RegisteredName;
            brand.OrgVerificationSource = result.Source;
            _logger.LogInformation("Org number verified for brand {BrandId} via {Source}", brand.Id, result.Source);
            return new Outcome(true, result.RegisteredName != null
                ? $"Verifierat mot momsregistret: {result.RegisteredName}"
                : "Verifierat mot momsregistret.");
        }

        if (result.Error != null)
        {
            // Lookup failed — keep an existing verification of the same number, otherwise stay unverified.
            if (numberChanged) Revoke(brand);
            return new Outcome(brand.OrgVerified, brand.OrgVerified
                ? "Registret kunde inte nås just nu; tidigare verifiering gäller."
                : $"Kunde inte verifiera just nu ({result.Error}). Vi försöker igen automatiskt.");
        }

        Revoke(brand);
        return new Outcome(false, "Organisationsnumret finns inte i momsregistret. Kontrollera numret eller kontakta support.");
    }

    /// <summary>Manual verification by an admin who has seen registration documents.</summary>
    public static void SetByAdmin(BrandProfile brand, bool verified, string? registeredName)
    {
        var now = DateTime.UtcNow;
        brand.OrgVerificationCheckedAt = now;
        if (!verified) { Revoke(brand); return; }
        brand.OrgVerified = true;
        brand.OrgVerifiedAt = now;
        brand.OrgVerifiedName = registeredName;
        brand.OrgVerificationSource = "Admin";
    }

    private static void Revoke(BrandProfile brand)
    {
        brand.OrgVerified = false;
        brand.OrgVerifiedAt = null;
        brand.OrgVerifiedName = null;
        brand.OrgVerificationSource = null;
    }
}
