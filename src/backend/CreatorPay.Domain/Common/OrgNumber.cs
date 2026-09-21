namespace CreatorPay.Domain.Common;

/// <summary>
/// Swedish organisation numbers (organisationsnummer): ten digits where the
/// last one is a Luhn (mod-10) check digit. A number that fails the check can
/// never belong to a real company, so it is rejected before any registry call.
/// Passing the check is NOT verification — that requires a registry lookup.
/// </summary>
public static class OrgNumber
{
    /// <summary>Keeps digits only; returns null unless exactly ten remain.</summary>
    public static string? Digits(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        // 12-digit form (16XXXXXXXXXX) is accepted and reduced to the ten-digit form.
        if (digits.Length == 12 && digits.StartsWith("16")) digits = digits[2..];
        return digits.Length == 10 ? digits : null;
    }

    /// <summary>XXXXXX-XXXX, or null when the input is not ten digits.</summary>
    public static string? Normalize(string? raw)
    {
        var d = Digits(raw);
        return d == null ? null : $"{d[..6]}-{d[6..]}";
    }

    /// <summary>Luhn check over the ten digits. Format validity only.</summary>
    public static bool IsValid(string? raw)
    {
        var d = Digits(raw);
        if (d == null) return false;
        // Swedish org numbers: third digit is at least 2 (distinguishes them from
        // personal numbers whose month is 01–12).
        if (d[2] - '0' < 2) return false;
        var sum = 0;
        for (var i = 0; i < 10; i++)
        {
            var n = d[i] - '0';
            if (i % 2 == 0) { n *= 2; if (n > 9) n -= 9; }
            sum += n;
        }
        return sum % 10 == 0;
    }

    /// <summary>Swedish VAT number as VIES expects it: SE + 10 digits + 01.</summary>
    public static string? ToVatNumber(string? raw)
    {
        var d = Digits(raw);
        return d == null ? null : $"{d}01";
    }
}
