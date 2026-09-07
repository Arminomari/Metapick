namespace CreatorPay.Domain.Ugc;

/// <summary>What the brand pays and what the creator gets, in öre.</summary>
public sealed record UgcQuote(long CreatorAmountOre, long PlatformFeeOre, long BrandTotalOre, decimal FeePercent);

/// <summary>How a disputed amount is divided, in öre. Always sums to the agreed amount.</summary>
public sealed record UgcSplit(long ToCreatorOre, long ToBrandOre);

/// <summary>
/// The only place fee math lives. Amounts are integers in öre; the fee is a
/// percentage of the creator's amount, added on top for the brand — the
/// creator always receives exactly what was agreed.
/// </summary>
public static class UgcFeeCalculator
{
    public const decimal DefaultFeePercent = 15m;

    public static UgcQuote Quote(long creatorAmountOre, decimal feePercent = DefaultFeePercent)
    {
        if (creatorAmountOre < 0) throw new ArgumentOutOfRangeException(nameof(creatorAmountOre), "Beloppet kan inte vara negativt.");
        if (feePercent is < 0 or > 100) throw new ArgumentOutOfRangeException(nameof(feePercent), "Avgiften måste vara 0–100 %.");

        var fee = (long)Math.Round(creatorAmountOre * feePercent / 100m, 0, MidpointRounding.AwayFromZero);
        return new UgcQuote(creatorAmountOre, fee, creatorAmountOre + fee, feePercent);
    }

    /// <summary>
    /// Dispute split of the creator's agreed amount. The platform fee is not
    /// part of the split: it is refunded to the brand only on a full refund
    /// (see <see cref="FeeRefundedOnDecision"/>).
    /// </summary>
    public static UgcSplit SplitAgreed(long agreedOre, int creatorSharePercent)
    {
        if (agreedOre < 0) throw new ArgumentOutOfRangeException(nameof(agreedOre));
        if (creatorSharePercent is < 0 or > 100) throw new ArgumentOutOfRangeException(nameof(creatorSharePercent), "Andelen måste vara 0–100 %.");

        var toCreator = (long)Math.Round(agreedOre * creatorSharePercent / 100m, 0, MidpointRounding.AwayFromZero);
        return new UgcSplit(toCreator, agreedOre - toCreator);
    }

    /// <summary>
    /// Whether Vyrle gives its fee back. Only when the brand gets everything back
    /// (no delivery accepted at all); a split or a creator win keeps the fee,
    /// because the platform did its job.
    /// </summary>
    public static bool FeeRefundedOnDecision(Enums.UgcDisputeDecision decision)
        => decision == Enums.UgcDisputeDecision.RefundBrand;

    /// <summary>Whole kronor for display: 1 234 567 öre → "12 345,67 kr".</summary>
    public static string FormatSek(long ore)
    {
        var negative = ore < 0;
        var abs = Math.Abs(ore);
        var kronor = (abs / 100).ToString("#,0", System.Globalization.CultureInfo.InvariantCulture).Replace(',', ' ');
        var s = $"{kronor},{abs % 100:00} kr";
        return negative ? "−" + s : s;
    }
}
