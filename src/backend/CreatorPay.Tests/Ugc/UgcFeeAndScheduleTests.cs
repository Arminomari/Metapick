using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Ugc;

namespace CreatorPay.Tests.Ugc;

public class UgcFeeCalculatorTests
{
    [Theory]
    [InlineData(100_000, 15, 15_000, 115_000)]   // 1 000 kr → 150 kr fee
    [InlineData(333, 15, 50, 383)]               // 49.95 öre rounds up
    [InlineData(1, 15, 0, 1)]                    // 0.15 öre rounds down
    [InlineData(10, 15, 2, 12)]                  // 1.5 → 2 (away from zero)
    [InlineData(100_000, 0, 0, 100_000)]
    [InlineData(0, 15, 0, 0)]
    [InlineData(250_000, 12.5, 31_250, 281_250)]
    public void Quote_fee_on_top_of_creator_amount(long creator, decimal pct, long fee, long total)
    {
        var q = UgcFeeCalculator.Quote(creator, pct);
        Assert.Equal(creator, q.CreatorAmountOre);
        Assert.Equal(fee, q.PlatformFeeOre);
        Assert.Equal(total, q.BrandTotalOre);
        Assert.Equal(q.CreatorAmountOre + q.PlatformFeeOre, q.BrandTotalOre);
    }

    [Fact]
    public void Default_fee_is_15_percent() => Assert.Equal(15m, UgcFeeCalculator.Quote(100).FeePercent);

    [Fact]
    public void Quote_rejects_nonsense()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => UgcFeeCalculator.Quote(-1));
        Assert.Throws<ArgumentOutOfRangeException>(() => UgcFeeCalculator.Quote(100, -1));
        Assert.Throws<ArgumentOutOfRangeException>(() => UgcFeeCalculator.Quote(100, 101));
    }

    [Theory]
    [InlineData(10_001, 50, 5_001, 5_000)]
    [InlineData(10_000, 0, 0, 10_000)]
    [InlineData(10_000, 100, 10_000, 0)]
    [InlineData(999, 33, 330, 669)]
    public void Split_always_sums_to_the_agreed_amount(long agreed, int share, long creator, long brand)
    {
        var s = UgcFeeCalculator.SplitAgreed(agreed, share);
        Assert.Equal(creator, s.ToCreatorOre);
        Assert.Equal(brand, s.ToBrandOre);
        Assert.Equal(agreed, s.ToCreatorOre + s.ToBrandOre);
    }

    [Fact]
    public void Fee_is_only_refunded_on_a_full_refund()
    {
        Assert.True(UgcFeeCalculator.FeeRefundedOnDecision(UgcDisputeDecision.RefundBrand));
        Assert.False(UgcFeeCalculator.FeeRefundedOnDecision(UgcDisputeDecision.PayCreator));
        Assert.False(UgcFeeCalculator.FeeRefundedOnDecision(UgcDisputeDecision.Split));
    }

    [Theory]
    [InlineData(1_234_567, "12 345,67 kr")]
    [InlineData(5, "0,05 kr")]
    [InlineData(100, "1,00 kr")]
    [InlineData(0, "0,00 kr")]
    [InlineData(-100, "−1,00 kr")]
    public void FormatSek(long ore, string expected) => Assert.Equal(expected, UgcFeeCalculator.FormatSek(ore));
}

public class UgcScheduleTests
{
    private static readonly DateTime Now = new(2026, 9, 8, 12, 0, 0, DateTimeKind.Utc);

    private static UgcCollab C(UgcCollabStatus s) => new() { Status = s, Title = "t", BriefSnapshot = "b", ContractText = "c", ContractHash = "h", ContractTemplateVersion = "v" };

    [Fact]
    public void Clocks_are_simple_day_arithmetic_with_a_floor_of_one_day()
    {
        Assert.Equal(Now.AddDays(7), UgcSchedule.DeadlineFromAcceptance(Now, 7));
        Assert.Equal(Now.AddDays(1), UgcSchedule.DeadlineFromAcceptance(Now, 0));
        Assert.Equal(Now.AddDays(5), UgcSchedule.AutoApproveAt(Now));
        Assert.Equal(Now.AddDays(3), UgcSchedule.RevisionDeadline(Now));
        Assert.Equal(Now.AddDays(1), UgcSchedule.RevisionDeadline(Now, -4));
    }

    [Theory]
    [InlineData(UgcCollabStatus.Accepted, true)]
    [InlineData(UgcCollabStatus.InProgress, true)]
    [InlineData(UgcCollabStatus.RevisionRequested, true)]
    [InlineData(UgcCollabStatus.Invited, false)]
    [InlineData(UgcCollabStatus.Submitted, false)]
    [InlineData(UgcCollabStatus.Approved, false)]
    [InlineData(UgcCollabStatus.Paid, false)]
    [InlineData(UgcCollabStatus.Cancelled, false)]
    [InlineData(UgcCollabStatus.Disputed, false)]
    public void NoShow_only_while_a_delivery_is_awaited(UgcCollabStatus s, bool expected)
    {
        var c = C(s); c.DeadlineAt = Now.AddMinutes(-1);
        Assert.Equal(expected, UgcSchedule.IsNoShow(c, Now));
    }

    [Fact]
    public void NoShow_needs_a_passed_deadline()
    {
        var c = C(UgcCollabStatus.Accepted);
        Assert.False(UgcSchedule.IsNoShow(c, Now));                           // no deadline yet
        c.DeadlineAt = Now; Assert.False(UgcSchedule.IsNoShow(c, Now));       // exactly now is not late
        c.DeadlineAt = Now.AddSeconds(-1); Assert.True(UgcSchedule.IsNoShow(c, Now));
    }

    [Fact]
    public void AutoApprove_is_due_when_the_clock_passes_and_no_dispute_is_open()
    {
        var c = C(UgcCollabStatus.Submitted); c.AutoApproveAt = Now;
        Assert.True(UgcSchedule.IsAutoApproveDue(c, Now));
        c.AutoApproveAt = Now.AddSeconds(1);
        Assert.False(UgcSchedule.IsAutoApproveDue(c, Now));
        c.AutoApproveAt = Now;
        c.Dispute = new UgcDispute { Status = UgcDisputeStatus.Open, Reason = "r" };
        Assert.False(UgcSchedule.IsAutoApproveDue(c, Now));
        c.Dispute.Status = UgcDisputeStatus.Resolved;
        Assert.True(UgcSchedule.IsAutoApproveDue(c, Now));
        c.Status = UgcCollabStatus.Approved;
        Assert.False(UgcSchedule.IsAutoApproveDue(c, Now));
    }

    [Fact]
    public void Deadline_reminders_open_in_windows_and_fire_once()
    {
        var c = C(UgcCollabStatus.InProgress);

        c.DeadlineAt = Now.AddHours(49);
        Assert.Empty(UgcSchedule.DueReminders(c, Now));

        c.DeadlineAt = Now.AddHours(47);
        Assert.Equal(new[] { UgcReminderKind.Deadline48h }, UgcSchedule.DueReminders(c, Now).ToArray());

        c.DeadlineReminder48hSentAt = Now;
        Assert.Empty(UgcSchedule.DueReminders(c, Now));

        c.DeadlineAt = Now.AddHours(23);
        Assert.Equal(new[] { UgcReminderKind.Deadline24h }, UgcSchedule.DueReminders(c, Now).ToArray());

        // Neither sent, inside both windows → both are due (a job that was down).
        c.DeadlineReminder48hSentAt = null;
        Assert.Equal(new[] { UgcReminderKind.Deadline48h, UgcReminderKind.Deadline24h }, UgcSchedule.DueReminders(c, Now).ToArray());

        // Past the deadline: nothing is reminded late — that is the no-show path.
        c.DeadlineAt = Now.AddMinutes(-1);
        Assert.Empty(UgcSchedule.DueReminders(c, Now));
    }

    [Fact]
    public void Auto_approve_reminder_respects_window_marker_and_dispute()
    {
        var c = C(UgcCollabStatus.Submitted);
        c.AutoApproveAt = Now.AddHours(25);
        Assert.Empty(UgcSchedule.DueReminders(c, Now));

        c.AutoApproveAt = Now.AddHours(23);
        Assert.Equal(new[] { UgcReminderKind.AutoApprove24h }, UgcSchedule.DueReminders(c, Now).ToArray());

        c.AutoApproveReminderSentAt = Now;
        Assert.Empty(UgcSchedule.DueReminders(c, Now));

        c.AutoApproveReminderSentAt = null;
        c.Dispute = new UgcDispute { Status = UgcDisputeStatus.Open, Reason = "r" };
        Assert.Empty(UgcSchedule.DueReminders(c, Now));
    }

    [Fact]
    public void OnTime_compares_submission_to_deadline()
    {
        var c = C(UgcCollabStatus.Approved);
        c.DeadlineAt = Now; c.SubmittedAt = Now;
        Assert.True(UgcSchedule.WasOnTime(c));
        c.SubmittedAt = Now.AddSeconds(1);
        Assert.False(UgcSchedule.WasOnTime(c));
        c.SubmittedAt = null;
        Assert.False(UgcSchedule.WasOnTime(c));
    }
}

public class UgcVerificationRuleTests
{
    private static readonly UgcVerificationThresholds T = new(1_000, 0.05m, 3);

    [Theory]
    [InlineData(UgcCreatorStatus.Pending, 1_000, 0.05, true, UgcCreatorStatus.Verified)]
    [InlineData(UgcCreatorStatus.Pending, 999, 0.05, true, UgcCreatorStatus.Pending)]
    [InlineData(UgcCreatorStatus.Pending, 5_000, 0.049, true, UgcCreatorStatus.Pending)]
    [InlineData(UgcCreatorStatus.Pending, 5_000, 0.2, false, UgcCreatorStatus.Pending)]
    [InlineData(UgcCreatorStatus.Verified, 10, 0.0, false, UgcCreatorStatus.Pending)]     // numbers fell — back to review
    [InlineData(UgcCreatorStatus.Approved, 10, 0.0, false, UgcCreatorStatus.Approved)]    // admin's call stands
    [InlineData(UgcCreatorStatus.Suspended, 99_999, 1.0, true, UgcCreatorStatus.Suspended)]
    public void Evaluate(UgcCreatorStatus current, int followers, double ratio, bool sample, UgcCreatorStatus expected)
        => Assert.Equal(expected, UgcVerificationRule.Evaluate(current, followers, (decimal)ratio, sample, T));

    [Fact]
    public void Ratio_never_divides_by_zero()
    {
        Assert.Equal(0m, UgcVerificationRule.LikeFollowerRatio(500, 0));
        Assert.Equal(0.05m, UgcVerificationRule.LikeFollowerRatio(50, 1_000));
        Assert.Equal(1.3333m, UgcVerificationRule.LikeFollowerRatio(4, 3));
    }

    [Theory]
    [InlineData(2, false)]
    [InlineData(3, true)]
    [InlineData(7, true)]
    public void Three_strikes(int strikes, bool suspend) => Assert.Equal(suspend, UgcVerificationRule.ShouldSuspend(strikes, T));

    [Theory]
    [InlineData(UgcCreatorStatus.Pending, UgcCompensationType.ProductExchange, true, true, false, false)]
    [InlineData(UgcCreatorStatus.Verified, UgcCompensationType.ProductExchange, false, false, true, true)]
    [InlineData(UgcCreatorStatus.Verified, UgcCompensationType.Paid, false, true, false, false)]   // no payout account
    [InlineData(UgcCreatorStatus.Verified, UgcCompensationType.Paid, true, false, false, true)]    // F-tax not required
    [InlineData(UgcCreatorStatus.Verified, UgcCompensationType.Paid, true, false, true, false)]    // F-tax required, missing
    [InlineData(UgcCreatorStatus.Approved, UgcCompensationType.PaidPlusProduct, true, true, true, true)]
    [InlineData(UgcCreatorStatus.Suspended, UgcCompensationType.Paid, true, true, false, false)]
    public void CanApply(UgcCreatorStatus status, UgcCompensationType comp, bool onboarded, bool fTax, bool requireFTax, bool expected)
        => Assert.Equal(expected, UgcVerificationRule.CanApply(status, comp, onboarded, fTax, requireFTax));
}
