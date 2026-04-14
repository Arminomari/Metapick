using CreatorPay.Application.Interfaces;
using CreatorPay.Application.PayoutEngine;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Worker.Jobs;

/// <summary>
/// PayoutRecalculationJob – räknar om utbetalningsbelopp för alla aktiva uppdrag
/// baserat på aktuella verifierade views. Körs oberoende av TikTok-synken.
/// Körs dagligen kl 04:00 UTC.
/// </summary>
public class PayoutRecalculationJob
{
    private readonly ILogger<PayoutRecalculationJob> _logger;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<PayoutCalculation> _calculations;
    private readonly IRepository<Campaign> _campaigns;
    private readonly IUnitOfWork _uow;
    private readonly PayoutCalculatorFactory _payoutFactory;

    public PayoutRecalculationJob(
        ILogger<PayoutRecalculationJob> logger,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<PayoutCalculation> calculations,
        IRepository<Campaign> campaigns,
        IUnitOfWork uow,
        PayoutCalculatorFactory payoutFactory)
    {
        _logger = logger;
        _assignments = assignments;
        _calculations = calculations;
        _campaigns = campaigns;
        _uow = uow;
        _payoutFactory = payoutFactory;
    }

    public async Task ExecuteAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("PayoutRecalculationJob started at {Time}", DateTime.UtcNow);

        var activeAssignments = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c!.PayoutRules)
            .Where(a => a.Status == AssignmentStatus.Active && a.Campaign != null)
            .ToListAsync(ct);

        _logger.LogInformation("Recalculating payouts for {Count} active assignments", activeAssignments.Count);

        int updated = 0;

        foreach (var assignment in activeAssignments)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var campaign = assignment.Campaign!;
                var payoutRules = campaign.PayoutRules.OrderBy(r => r.SortOrder).ToList();

                if (!payoutRules.Any()) continue;

                var calculator = _payoutFactory.Create(campaign.PayoutModel);
                var result = calculator.Calculate(assignment.TotalVerifiedViews, payoutRules);

                // Only update + create calculation record if amount changed
                if (result.Amount == assignment.CurrentPayoutAmount) continue;

                assignment.CurrentPayoutAmount = result.Amount;

                _calculations.Add(new PayoutCalculation
                {
                    AssignmentId = assignment.Id,
                    VerifiedViews = assignment.TotalVerifiedViews,
                    CalculatedAmount = result.Amount,
                    PayoutRuleId = result.AppliedRuleId,
                    CalculationDetails = result.Details,
                    Status = PayoutCalculationStatus.Preliminary,
                    CalculatedAt = DateTime.UtcNow
                });

                updated++;

                _logger.LogDebug("Assignment {Id}: recalculated {Views} views → {Amount} SEK",
                    assignment.Id, assignment.TotalVerifiedViews, result.Amount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to recalculate payout for assignment {Id}", assignment.Id);
            }
        }

        await _uow.SaveChangesAsync(ct);
        _logger.LogInformation("PayoutRecalculationJob completed — {Updated} assignments updated", updated);
    }
}
