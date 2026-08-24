using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.PayoutEngine;

/// <summary>
/// Monthly accounting for a tap ("kranen"): a standing monthly budget that
/// continuously pays the brand's community per verified view.
///
/// Rules (product decisions, not tunables):
///  - Monthly budget is a HARD cap: once the month is at 100 % nothing more
///    accrues until the next calendar month. No rollover.
///  - Fixed CPM per tap (the 20 kr floor is enforced at creation).
///  - Optional payout cap per video and monthly cap per creator → breadth
///    before virality.
///  - Views only count for videos published within the month.
/// Accruals are additive: money already credited is never taken back by a
/// later recalculation; capacity is consumed in recalculation order.
/// </summary>
public sealed class TapAccrualService
{
    private readonly IRepository<TapAccrual> _accruals;
    private readonly IRepository<SocialPost> _posts;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<PayoutCalculation> _calculations;
    private readonly IUnitOfWork _uow;

    public TapAccrualService(
        IRepository<TapAccrual> accruals,
        IRepository<SocialPost> posts,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<PayoutCalculation> calculations,
        IUnitOfWork uow)
    {
        _accruals = accruals;
        _posts = posts;
        _assignments = assignments;
        _calculations = calculations;
        _uow = uow;
    }

    public sealed record MonthSummary(decimal Budget, decimal Spent, decimal Remaining, long Views, int ActiveCreators);

    public static decimal CpmOf(Campaign tap) =>
        tap.PayoutRules.Where(r => r.PayoutType == PayoutType.CPM).Select(r => r.Amount).FirstOrDefault();

    /// <summary>Recalculates the current month for one tap and persists.</summary>
    public async Task<MonthSummary> RecalculateAsync(Campaign tap, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var (y, m) = (now.Year, now.Month);
        var monthStart = new DateTime(y, m, 1, 0, 0, 0, DateTimeKind.Utc);
        var cpm = CpmOf(tap);

        var assignments = await _assignments.Query()
            .Where(a => a.CampaignId == tap.Id && a.Status == AssignmentStatus.Active)
            .ToListAsync(ct);
        if (assignments.Count == 0)
            return new MonthSummary(tap.MonthlyBudget, 0, tap.MonthlyBudget, 0, 0);

        var ids = assignments.Select(a => a.Id).ToList();
        var posts = await _posts.Query()
            .Where(p => ids.Contains(p.AssignmentId) && p.IsActive
                && p.VerificationStatus == VerificationStatus.Verified
                && p.PublishedAt >= monthStart)
            .ToListAsync(ct);
        var persisted = await _accruals.Query()
            .Where(x => ids.Contains(x.AssignmentId))
            .ToListAsync(ct);

        var thisMonth = persisted.Where(x => x.Year == y && x.Month == m).ToList();
        var otherMonths = persisted.Where(x => !(x.Year == y && x.Month == m)).ToList();

        var spent = thisMonth.Sum(x => x.Amount);
        var remaining = Math.Max(0, tap.MonthlyBudget - spent);
        long monthViews = 0;
        var activeCreators = 0;

        foreach (var a in assignments)
        {
            var mine = posts.Where(p => p.AssignmentId == a.Id).ToList();
            var views = mine.Sum(p => p.LatestViewCount);
            monthViews += views;
            if (views > 0) activeCreators++;

            var raw = mine.Sum(p =>
            {
                var v = p.LatestViewCount * cpm / 1000m;
                return tap.PayoutCapPerVideo is > 0 ? Math.Min(v, tap.PayoutCapPerVideo.Value) : v;
            });
            if (tap.MonthlyCapPerCreator is > 0) raw = Math.Min(raw, tap.MonthlyCapPerCreator.Value);
            raw = Math.Round(raw, 2);

            var acc = thisMonth.FirstOrDefault(x => x.AssignmentId == a.Id);
            if (acc == null)
            {
                acc = new TapAccrual { AssignmentId = a.Id, Year = y, Month = m };
                _accruals.Add(acc);
                thisMonth.Add(acc);
            }
            acc.Views = views;

            var delta = raw - acc.Amount;
            if (delta > 0)
            {
                var allowed = Math.Min(delta, remaining);
                acc.Amount += allowed;
                remaining -= allowed;
            }

            var lifetime = otherMonths.Where(x => x.AssignmentId == a.Id).Sum(x => x.Amount) + acc.Amount;
            if (lifetime != a.CurrentPayoutAmount)
            {
                a.CurrentPayoutAmount = lifetime;

                // Exactly one calculation per assignment may be current — the
                // payout request path pays against it.
                foreach (var stale in await _calculations.Query()
                    .Where(c => c.AssignmentId == a.Id && c.IsLatest).ToListAsync(ct))
                    stale.IsLatest = false;

                _calculations.Add(new PayoutCalculation
                {
                    AssignmentId = a.Id,
                    VerifiedViews = a.TotalVerifiedViews,
                    CalculatedAmount = lifetime,
                    CalculationDetails = $"tap {y}-{m:00}: views={views} cpm={cpm} month={acc.Amount}",
                    Status = PayoutCalculationStatus.Preliminary,
                    CalculatedAt = DateTime.UtcNow
                });
            }
        }

        tap.BudgetSpent = otherMonths.Sum(x => x.Amount) + thisMonth.Sum(x => x.Amount);
        await _uow.SaveChangesAsync(ct);

        var spentNow = thisMonth.Sum(x => x.Amount);
        return new MonthSummary(tap.MonthlyBudget, spentNow, Math.Max(0, tap.MonthlyBudget - spentNow), monthViews, activeCreators);
    }

    /// <summary>Read-only month summary (no recalculation).</summary>
    public async Task<MonthSummary> SummarizeAsync(Campaign tap, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var ids = await _assignments.Query()
            .Where(a => a.CampaignId == tap.Id)
            .Select(a => a.Id)
            .ToListAsync(ct);
        var rows = await _accruals.Query()
            .Where(x => ids.Contains(x.AssignmentId) && x.Year == now.Year && x.Month == now.Month)
            .ToListAsync(ct);
        var spent = rows.Sum(x => x.Amount);
        return new MonthSummary(tap.MonthlyBudget, spent, Math.Max(0, tap.MonthlyBudget - spent),
            rows.Sum(x => x.Views), rows.Count(x => x.Views > 0));
    }
}
