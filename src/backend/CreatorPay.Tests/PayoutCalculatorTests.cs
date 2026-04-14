using CreatorPay.Application.PayoutEngine;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Tests;

/// <summary>
/// Unit tests for payout calculator strategies.
/// These are pure-function tests — no DB or HTTP required.
/// </summary>
public class PayoutCalculatorTests
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private static PayoutRule Rule(PayoutType type, long minViews, decimal amount,
        decimal? cap = null, int sort = 0) => new()
    {
        Id = Guid.NewGuid(),
        PayoutType = type,
        MinViews = minViews,
        Amount = amount,
        MaxPayoutPerCreator = cap,
        SortOrder = sort,
    };

    private static List<PayoutRule> Fixed(long minViews, decimal amount, decimal? cap = null)
        => [Rule(PayoutType.FixedThreshold, minViews, amount, cap)];

    // ── FixedThresholdCalculator ─────────────────────────────────────────────

    [Theory]
    [InlineData(0, 0)]         // below threshold → 0
    [InlineData(499, 0)]       // just below threshold → 0
    [InlineData(500, 300)]     // meets threshold exactly → pays out
    [InlineData(100_000, 300)] // way above threshold → still fixed amount
    public void FixedThreshold_CorrectAmount(long views, decimal expected)
    {
        var calc = new FixedThresholdCalculator();
        var result = calc.Calculate(views, Fixed(500, 300));
        Assert.Equal(expected, result.Amount);
    }

    [Fact]
    public void FixedThreshold_RespectsCap()
    {
        var calc = new FixedThresholdCalculator();
        var result = calc.Calculate(50_000, Fixed(1000, 1000, cap: 500));
        Assert.Equal(500m, result.Amount);
    }

    [Fact]
    public void FixedThreshold_HighestMatchingRuleWins()
    {
        // Two rules: 1000 views = 100 kr, 5000 views = 500 kr
        var rules = new List<PayoutRule>
        {
            Rule(PayoutType.FixedThreshold, 1000, 100),
            Rule(PayoutType.FixedThreshold, 5000, 500),
        };
        var calc = new FixedThresholdCalculator();

        // 6000 views should match the 5000-tier
        var result = calc.Calculate(6000, rules);
        Assert.Equal(500m, result.Amount);
    }

    [Fact]
    public void FixedThreshold_DetailsStringContainsViews()
    {
        var calc = new FixedThresholdCalculator();
        var result = calc.Calculate(1000, Fixed(500, 200));
        Assert.Contains("1000", result.Details);
    }

    // ── TieredPayoutCalculator ───────────────────────────────────────────────

    private static List<PayoutRule> Tiered(params (long min, decimal amt)[] tiers)
        => tiers.Select(t => Rule(PayoutType.Tiered, t.min, t.amt)).ToList();

    [Theory]
    [InlineData(0, 0)]        // below all tiers
    [InlineData(4999, 0)]
    [InlineData(5000, 200)]   // hits first tier
    [InlineData(9999, 200)]   // still in first tier
    [InlineData(10_000, 500)] // hits second tier
    [InlineData(50_000, 500)] // above both, stays in highest matching
    public void Tiered_CorrectTierSelected(long views, decimal expected)
    {
        var calc = new TieredPayoutCalculator();
        var result = calc.Calculate(views, Tiered((5000, 200), (10_000, 500)));
        Assert.Equal(expected, result.Amount);
    }

    [Fact]
    public void Tiered_RespectsCap()
    {
        var rules = new List<PayoutRule>
        {
            Rule(PayoutType.Tiered, 10_000, 1000, cap: 600)
        };
        var calc = new TieredPayoutCalculator();
        var result = calc.Calculate(50_000, rules);
        Assert.Equal(600m, result.Amount);
    }

    // ── CpmPayoutCalculator ──────────────────────────────────────────────────

    private static List<PayoutRule> Cpm(decimal cpmRate, decimal? cap = null)
        => [Rule(PayoutType.CPM, 0, cpmRate, cap)];

    [Theory]
    [InlineData(1000, 40, 40)]         // 1000 views × 40/1000 = 40
    [InlineData(10_000, 40, 400)]      // 10k × 40/1000 = 400
    [InlineData(1, 40, 0.04)]          // fractional
    [InlineData(0, 40, 0)]             // zero views
    public void Cpm_CorrectAmount(long views, decimal rate, decimal expected)
    {
        var calc = new CpmPayoutCalculator();
        var result = calc.Calculate(views, Cpm(rate));
        Assert.Equal(Math.Round(expected, 2), result.Amount);
    }

    [Fact]
    public void Cpm_RespectsCap()
    {
        var calc = new CpmPayoutCalculator();
        // 100k views × 50/1000 = 5000, but cap is 3000
        var result = calc.Calculate(100_000, Cpm(50, cap: 3000));
        Assert.Equal(3000m, result.Amount);
    }

    [Fact]
    public void Cpm_NoRuleReturnsZero()
    {
        // Empty rule list with wrong type → should fallback gracefully
        var calc = new CpmPayoutCalculator();
        var result = calc.Calculate(50_000, [Rule(PayoutType.FixedThreshold, 0, 100)]);
        Assert.Equal(0m, result.Amount);
    }

    // ── HybridPayoutCalculator ───────────────────────────────────────────────

    [Fact]
    public void Hybrid_BaseOnlyWhenBelowBonusTier()
    {
        var rules = new List<PayoutRule>
        {
            Rule(PayoutType.FixedThreshold, 3000, 300, sort: 0),
            Rule(PayoutType.BonusAboveThreshold, 20_000, 500, sort: 1),
        };
        var calc = new HybridPayoutCalculator();
        var result = calc.Calculate(5000, rules);
        Assert.Equal(300m, result.Amount);
    }

    [Fact]
    public void Hybrid_BaseAndOneBonusApplied()
    {
        var rules = new List<PayoutRule>
        {
            Rule(PayoutType.FixedThreshold, 3000, 300, sort: 0),
            Rule(PayoutType.BonusAboveThreshold, 20_000, 500, sort: 1),
        };
        var calc = new HybridPayoutCalculator();
        var result = calc.Calculate(25_000, rules);
        Assert.Equal(800m, result.Amount); // 300 + 500
    }

    [Fact]
    public void Hybrid_MultipleBonus()
    {
        var rules = new List<PayoutRule>
        {
            Rule(PayoutType.FixedThreshold, 3000, 300, sort: 0),
            Rule(PayoutType.BonusAboveThreshold, 20_000, 500, sort: 1),
            Rule(PayoutType.BonusAboveThreshold, 100_000, 1500, sort: 2),
        };
        var calc = new HybridPayoutCalculator();
        var result = calc.Calculate(150_000, rules);
        Assert.Equal(2300m, result.Amount); // 300 + 500 + 1500
    }

    [Fact]
    public void Hybrid_BelowBaseThreshold_ReturnsZero()
    {
        var rules = new List<PayoutRule>
        {
            Rule(PayoutType.FixedThreshold, 3000, 300, sort: 0),
            Rule(PayoutType.BonusAboveThreshold, 20_000, 500, sort: 1),
        };
        var calc = new HybridPayoutCalculator();
        var result = calc.Calculate(100, rules);
        Assert.Equal(0m, result.Amount);
    }

    [Fact]
    public void Hybrid_RespectsCap()
    {
        var capRule = Rule(PayoutType.FixedThreshold, 3000, 300, cap: 400, sort: 0);
        var bonusRule = Rule(PayoutType.BonusAboveThreshold, 10_000, 500, sort: 1);
        var calc = new HybridPayoutCalculator();
        var result = calc.Calculate(50_000, [capRule, bonusRule]);
        Assert.Equal(400m, result.Amount); // 300+500=800 but cap=400
    }

    // ── PayoutCalculatorFactory ──────────────────────────────────────────────

    [Fact]
    public void Factory_ReturnsCorrectCalculator()
    {
        var calculators = new List<IPayoutCalculator>
        {
            new FixedThresholdCalculator(),
            new TieredPayoutCalculator(),
            new CpmPayoutCalculator(),
            new HybridPayoutCalculator(),
        };
        var factory = new PayoutCalculatorFactory(calculators);

        Assert.IsType<FixedThresholdCalculator>(factory.Create(PayoutModel.Fixed));
        Assert.IsType<TieredPayoutCalculator>(factory.Create(PayoutModel.Tiered));
        Assert.IsType<CpmPayoutCalculator>(factory.Create(PayoutModel.CPM));
        Assert.IsType<HybridPayoutCalculator>(factory.Create(PayoutModel.Hybrid));
    }

    [Fact]
    public void Factory_ThrowsForUnknownModel()
    {
        var factory = new PayoutCalculatorFactory([]);
        Assert.Throws<InvalidOperationException>(() => factory.Create(PayoutModel.Fixed));
    }
}
