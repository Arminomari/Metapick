using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Application.PayoutEngine;

public interface IPayoutCalculator
{
    PayoutModel SupportedModel { get; }
    PayoutCalculationResult Calculate(long verifiedViews, List<PayoutRule> rules);
}

public record PayoutCalculationResult(
    decimal Amount,
    Guid AppliedRuleId,
    string Details);

/// <summary>
/// Skapar rätt IPayoutCalculator baserat på kampanjens PayoutModel.
/// </summary>
public class PayoutCalculatorFactory
{
    private readonly IEnumerable<IPayoutCalculator> _calculators;

    public PayoutCalculatorFactory(IEnumerable<IPayoutCalculator> calculators)
    {
        _calculators = calculators;
    }

    public IPayoutCalculator Create(PayoutModel model)
    {
        return _calculators.FirstOrDefault(c => c.SupportedModel == model)
            ?? throw new InvalidOperationException($"No calculator registered for payout model: {model}");
    }
}

/// <summary>
/// Fast payout om creator når minimum views.
/// Exempel: minst 10 000 views = 500 kr.
/// </summary>
public class FixedThresholdCalculator : IPayoutCalculator
{
    public PayoutModel SupportedModel => PayoutModel.Fixed;

    public PayoutCalculationResult Calculate(long verifiedViews, List<PayoutRule> rules)
    {
        var rule = rules
            .Where(r => r.PayoutType == PayoutType.FixedThreshold)
            .OrderByDescending(r => r.MinViews)
            .FirstOrDefault(r => verifiedViews >= r.MinViews);

        if (rule == null)
            return new PayoutCalculationResult(0, rules.First().Id, "Views below minimum threshold");

        var amount = rule.Amount;
        if (rule.MaxPayoutPerCreator.HasValue)
            amount = Math.Min(amount, rule.MaxPayoutPerCreator.Value);

        return new PayoutCalculationResult(
            amount,
            rule.Id,
            $"Fixed threshold: {verifiedViews} views >= {rule.MinViews} minimum → {amount} {rule.Currency}");
    }
}

/// <summary>
/// Stegvis ersättning — högsta matchande tier.
/// Exempel: 5000+ = 200, 10000+ = 500, 50000+ = 2000.
/// </summary>
public class TieredPayoutCalculator : IPayoutCalculator
{
    public PayoutModel SupportedModel => PayoutModel.Tiered;

    public PayoutCalculationResult Calculate(long verifiedViews, List<PayoutRule> rules)
    {
        var tieredRules = rules
            .Where(r => r.PayoutType == PayoutType.Tiered)
            .OrderByDescending(r => r.MinViews)
            .ToList();

        var matchedRule = tieredRules.FirstOrDefault(r => verifiedViews >= r.MinViews);

        if (matchedRule == null)
            return new PayoutCalculationResult(0, rules.First().Id, "Views below lowest tier");

        var amount = matchedRule.Amount;
        if (matchedRule.MaxPayoutPerCreator.HasValue)
            amount = Math.Min(amount, matchedRule.MaxPayoutPerCreator.Value);

        return new PayoutCalculationResult(
            amount,
            matchedRule.Id,
            $"Tiered: {verifiedViews} views matched tier {matchedRule.MinViews}+ → {amount} {matchedRule.Currency}");
    }
}

/// <summary>
/// CPM-baserad: belopp per 1000 views med optional cap.
/// Exempel: 40 kr per 1000 views, max 5000 kr.
/// </summary>
public class CpmPayoutCalculator : IPayoutCalculator
{
    public PayoutModel SupportedModel => PayoutModel.CPM;

    public PayoutCalculationResult Calculate(long verifiedViews, List<PayoutRule> rules)
    {
        var cpmRule = rules.FirstOrDefault(r => r.PayoutType == PayoutType.CPM);
        if (cpmRule == null)
            return new PayoutCalculationResult(0, rules.First().Id, "No CPM rule found");

        var rawAmount = (verifiedViews / 1000m) * cpmRule.Amount;
        var amount = rawAmount;

        if (cpmRule.MaxPayoutPerCreator.HasValue)
            amount = Math.Min(amount, cpmRule.MaxPayoutPerCreator.Value);

        return new PayoutCalculationResult(
            Math.Round(amount, 2),
            cpmRule.Id,
            $"CPM: ({verifiedViews}/1000) × {cpmRule.Amount} = {rawAmount:F2}, capped at {amount:F2} {cpmRule.Currency}");
    }
}

/// <summary>
/// Hybrid: grundbelopp + bonusar över trösklar.
/// Exempel: 300 kr bas (3000+ views) + 500 kr bonus (20000+) + 1500 kr bonus (100000+).
/// </summary>
public class HybridPayoutCalculator : IPayoutCalculator
{
    public PayoutModel SupportedModel => PayoutModel.Hybrid;

    public PayoutCalculationResult Calculate(long verifiedViews, List<PayoutRule> rules)
    {
        decimal totalAmount = 0;
        var appliedRules = new List<string>();
        Guid appliedRuleId = rules.First().Id;

        // Bas-belopp (FixedThreshold-regel med lägst sortOrder)
        var baseRule = rules
            .Where(r => r.PayoutType == PayoutType.FixedThreshold)
            .OrderBy(r => r.SortOrder)
            .FirstOrDefault();

        if (baseRule != null && verifiedViews >= baseRule.MinViews)
        {
            totalAmount += baseRule.Amount;
            appliedRuleId = baseRule.Id;
            appliedRules.Add($"Base: {baseRule.Amount} (>= {baseRule.MinViews} views)");
        }
        else
        {
            return new PayoutCalculationResult(0, rules.First().Id, "Views below base threshold");
        }

        // Bonusar (BonusAboveThreshold)
        var bonusRules = rules
            .Where(r => r.PayoutType == PayoutType.BonusAboveThreshold)
            .OrderBy(r => r.SortOrder);

        foreach (var bonus in bonusRules)
        {
            if (verifiedViews >= bonus.MinViews)
            {
                totalAmount += bonus.Amount;
                appliedRuleId = bonus.Id;
                appliedRules.Add($"Bonus: +{bonus.Amount} (>= {bonus.MinViews} views)");
            }
        }

        // Cap per creator (använd högsta regelns cap om den finns)
        var maxCap = rules.Where(r => r.MaxPayoutPerCreator.HasValue)
            .Select(r => r.MaxPayoutPerCreator!.Value)
            .DefaultIfEmpty(decimal.MaxValue)
            .Min();

        totalAmount = Math.Min(totalAmount, maxCap);

        return new PayoutCalculationResult(
            Math.Round(totalAmount, 2),
            appliedRuleId,
            string.Join(" | ", appliedRules) + $" → Total: {totalAmount}");
    }
}
