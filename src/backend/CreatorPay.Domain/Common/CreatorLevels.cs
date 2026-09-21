namespace CreatorPay.Domain.Common;

/// <summary>
/// Creator level is a function of money actually paid out through VYRLE
/// (payout requests with status Completed). The thresholds live here so the
/// server, not the browser, decides the level.
/// </summary>
public static class CreatorLevels
{
    public sealed record Tier(int Index, string Name, decimal MinPaid);

    public static readonly IReadOnlyList<Tier> Tiers =
    [
        new(0, "Rising", 0m),
        new(1, "Established", 5_000m),
        new(2, "Pro", 25_000m),
        new(3, "Elite", 100_000m),
        new(4, "Icon", 500_000m),
    ];

    public static Tier For(decimal totalPaid)
    {
        var tier = Tiers[0];
        foreach (var t in Tiers)
            if (totalPaid >= t.MinPaid) tier = t;
        return tier;
    }

    public static Tier? Next(Tier current)
        => current.Index + 1 < Tiers.Count ? Tiers[current.Index + 1] : null;

    /// <summary>0–100 progress from the current tier's floor to the next tier's floor.</summary>
    public static int ProgressPercent(decimal totalPaid)
    {
        var tier = For(totalPaid);
        var next = Next(tier);
        if (next == null) return 100;
        var span = next.MinPaid - tier.MinPaid;
        if (span <= 0) return 100;
        var pct = (double)((totalPaid - tier.MinPaid) / span) * 100.0;
        return (int)Math.Clamp(Math.Round(pct), 0, 100);
    }
}
