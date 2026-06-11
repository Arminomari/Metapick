namespace CreatorPay.Application.Common;

/// <summary>
/// Validation for user-supplied image references: either an https URL or an inline
/// base64 data URL (jpeg/png/webp) produced by the client-side resizer.
/// </summary>
public static class MediaValidation
{
    /// <summary>~300 KB of binary after base64 expansion — enough for a 512px avatar/logo.</summary>
    public const int MaxDataUrlLength = 400_000;
    public const int MaxHttpsUrlLength = 1_000;

    public static bool IsValidImageRef(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return value.Length <= MaxHttpsUrlLength;
        return value.Length <= MaxDataUrlLength &&
               (value.StartsWith("data:image/jpeg;base64,", StringComparison.Ordinal)
                || value.StartsWith("data:image/png;base64,", StringComparison.Ordinal)
                || value.StartsWith("data:image/webp;base64,", StringComparison.Ordinal));
    }

    public static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
