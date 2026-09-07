using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Ugc;
using S = CreatorPay.Domain.Enums.UgcCollabStatus;
using A = CreatorPay.Domain.Enums.UgcActor;

namespace CreatorPay.Tests.Ugc;

/// <summary>
/// The transition table, checked exhaustively against an independent copy of
/// the spec — every (from, to, actor) triple, allowed or not — plus every guard
/// and every side effect Apply is responsible for. Pure; no DB.
/// </summary>
public class UgcCollabStateMachineTests
{
    private static readonly DateTime Now = new(2026, 9, 8, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>Guards all pass: both accepted, funded, no dispute, revisions left.</summary>
    private static readonly UgcTransitionContext Permissive =
        new(true, true, true, UgcCompensationType.Paid, RevisionCount: 0, MaxRevisions: 2, DisputeOpen: false);

    /// <summary>The spec, written out by hand so the test does not just echo the code.</summary>
    private static readonly HashSet<(S, S, A)> Expected = Build(
        (S.Invited, S.Accepted, new[] { A.Creator, A.System }),
        (S.Invited, S.Cancelled, new[] { A.Brand, A.Creator, A.Admin, A.System }),
        (S.Accepted, S.InProgress, new[] { A.Creator, A.System }),
        (S.Accepted, S.Submitted, new[] { A.Creator }),
        (S.Accepted, S.Cancelled, new[] { A.Brand, A.Creator, A.Admin, A.System }),
        (S.InProgress, S.Submitted, new[] { A.Creator }),
        (S.InProgress, S.Cancelled, new[] { A.Brand, A.Creator, A.Admin, A.System }),
        (S.Submitted, S.Approved, new[] { A.Brand, A.System }),
        (S.Submitted, S.RevisionRequested, new[] { A.Brand }),
        (S.Submitted, S.Disputed, new[] { A.Brand, A.Creator }),
        (S.RevisionRequested, S.Submitted, new[] { A.Creator }),
        (S.RevisionRequested, S.Cancelled, new[] { A.Brand, A.Creator, A.Admin, A.System }),
        (S.RevisionRequested, S.Disputed, new[] { A.Brand, A.Creator }),
        (S.Approved, S.Paid, new[] { A.System }),
        (S.Disputed, S.Approved, new[] { A.Admin }),
        (S.Disputed, S.Cancelled, new[] { A.Admin }));

    private static HashSet<(S, S, A)> Build(params (S from, S to, A[] actors)[] rows)
    {
        var set = new HashSet<(S, S, A)>();
        foreach (var (from, to, actors) in rows)
            foreach (var a in actors) set.Add((from, to, a));
        return set;
    }

    public static IEnumerable<object[]> AllTriples()
    {
        foreach (var from in Enum.GetValues<S>())
            foreach (var to in Enum.GetValues<S>())
                foreach (var actor in Enum.GetValues<A>())
                    yield return [from, to, actor];
    }

    [Theory]
    [MemberData(nameof(AllTriples))]
    public void Every_triple_matches_the_spec(S from, S to, A actor)
    {
        var allowed = UgcCollabStateMachine.Check(from, to, actor, Permissive).Allowed;
        Assert.Equal(Expected.Contains((from, to, actor)), allowed);
    }

    [Fact]
    public void Spec_and_table_cover_the_same_pairs()
    {
        var table = UgcCollabStateMachine.AllRules()
            .SelectMany(r => r.Actors.Select(a => (r.From, r.To, a)))
            .ToHashSet();
        Assert.True(Expected.SetEquals(table), "table differs from spec");
    }

    [Theory]
    [InlineData(S.Paid)]
    [InlineData(S.Cancelled)]
    public void Terminal_states_have_no_exits(S terminal)
    {
        Assert.True(UgcCollabStateMachine.IsTerminal(terminal));
        foreach (var to in Enum.GetValues<S>())
            foreach (var actor in Enum.GetValues<A>())
                Assert.False(UgcCollabStateMachine.Check(terminal, to, actor, Permissive).Allowed);
    }

    [Fact]
    public void Same_state_is_never_a_transition()
    {
        foreach (var s in Enum.GetValues<S>())
            Assert.False(UgcCollabStateMachine.Check(s, s, A.Admin, Permissive).Allowed);
    }

    // ── Guards ───────────────────────────────────────────────────────

    [Fact]
    public void Accept_requires_both_signatures_and_money()
    {
        var noBrand = Permissive with { BrandAccepted = false };
        var noCreator = Permissive with { CreatorAccepted = false };
        var noMoney = Permissive with { Funded = false };

        Assert.False(UgcCollabStateMachine.Check(S.Invited, S.Accepted, A.Creator, noBrand).Allowed);
        Assert.False(UgcCollabStateMachine.Check(S.Invited, S.Accepted, A.Creator, noCreator).Allowed);
        Assert.False(UgcCollabStateMachine.Check(S.Invited, S.Accepted, A.Creator, noMoney).Allowed);
        Assert.True(UgcCollabStateMachine.Check(S.Invited, S.Accepted, A.Creator, Permissive).Allowed);
    }

    [Fact]
    public void Product_exchange_needs_no_money()
    {
        var free = Permissive with { Funded = false, Compensation = UgcCompensationType.ProductExchange };
        Assert.True(UgcCollabStateMachine.Check(S.Invited, S.Accepted, A.Creator, free).Allowed);
    }

    [Fact]
    public void Open_dispute_freezes_review()
    {
        var disputed = Permissive with { DisputeOpen = true };
        Assert.False(UgcCollabStateMachine.Check(S.Submitted, S.Approved, A.Brand, disputed).Allowed);
        Assert.False(UgcCollabStateMachine.Check(S.Submitted, S.Approved, A.System, disputed).Allowed);
        Assert.False(UgcCollabStateMachine.Check(S.Submitted, S.RevisionRequested, A.Brand, disputed).Allowed);
        Assert.False(UgcCollabStateMachine.Check(S.Submitted, S.Disputed, A.Brand, disputed).Allowed);
        // …but the admin's resolution out of Disputed does not care.
        Assert.True(UgcCollabStateMachine.Check(S.Disputed, S.Approved, A.Admin, disputed).Allowed);
        Assert.True(UgcCollabStateMachine.Check(S.Disputed, S.Cancelled, A.Admin, disputed).Allowed);
    }

    [Fact]
    public void Revisions_are_capped()
    {
        var spent = Permissive with { RevisionCount = 2, MaxRevisions = 2 };
        var check = UgcCollabStateMachine.Check(S.Submitted, S.RevisionRequested, A.Brand, spent);
        Assert.False(check.Allowed);
        Assert.Contains("Max 2", check.Reason);
        Assert.True(UgcCollabStateMachine.Check(S.Submitted, S.RevisionRequested, A.Brand, spent with { RevisionCount = 1 }).Allowed);
    }

    // ── Apply: side effects ──────────────────────────────────────────

    private static UgcCollab Collab(S status, int deadlineDays = 7) => new()
    {
        Id = Guid.NewGuid(), Status = status, DeadlineDays = deadlineDays, MaxRevisions = 2,
        Title = "t", BriefSnapshot = "b", ContractText = "c", ContractHash = "h", ContractTemplateVersion = "v",
        BrandAcceptedAt = Now.AddHours(-2), CreatorAcceptedAt = Now.AddHours(-1),
    };

    [Fact]
    public void Accept_starts_the_deadline_clock_once()
    {
        var c = Collab(S.Invited, deadlineDays: 5);
        UgcCollabStateMachine.Apply(c, S.Accepted, A.Creator, Now, Permissive);
        Assert.Equal(Now.AddDays(5), c.DeadlineAt);

        // A second Accept cannot happen, but a pre-set deadline is respected.
        var pre = Collab(S.Invited);
        pre.DeadlineAt = Now.AddDays(1);
        UgcCollabStateMachine.Apply(pre, S.Accepted, A.Creator, Now, Permissive);
        Assert.Equal(Now.AddDays(1), pre.DeadlineAt);
    }

    [Fact]
    public void Submit_starts_the_auto_approve_clock()
    {
        var c = Collab(S.InProgress);
        c.AutoApproveReminderSentAt = Now.AddDays(-9);
        UgcCollabStateMachine.Apply(c, S.Submitted, A.Creator, Now, Permissive with { AutoApproveDays = 5 });
        Assert.Equal(Now, c.SubmittedAt);
        Assert.Equal(Now.AddDays(5), c.AutoApproveAt);
        Assert.Null(c.AutoApproveReminderSentAt);
    }

    [Fact]
    public void Revision_counts_resets_clocks_and_reminders()
    {
        var c = Collab(S.Submitted);
        c.AutoApproveAt = Now.AddDays(5);
        c.DeadlineReminder48hSentAt = Now.AddDays(-3);
        c.DeadlineReminder24hSentAt = Now.AddDays(-2);
        UgcCollabStateMachine.Apply(c, S.RevisionRequested, A.Brand, Now, Permissive with { RevisionDeadlineDays = 3 }, note: "Fel produkt i bild");

        Assert.Equal(1, c.RevisionCount);
        Assert.Null(c.AutoApproveAt);
        Assert.Equal(Now.AddDays(3), c.DeadlineAt);
        Assert.Null(c.DeadlineReminder48hSentAt);
        Assert.Null(c.DeadlineReminder24hSentAt);
    }

    [Fact]
    public void Approve_Pay_Cancel_Dispute_stamp_their_timestamps()
    {
        var c = Collab(S.Submitted); c.AutoApproveAt = Now.AddDays(1);
        UgcCollabStateMachine.Apply(c, S.Approved, A.Brand, Now, Permissive);
        Assert.Equal(Now, c.ApprovedAt); Assert.Null(c.AutoApproveAt);

        UgcCollabStateMachine.Apply(c, S.Paid, A.System, Now.AddMinutes(1), Permissive);
        Assert.Equal(Now.AddMinutes(1), c.PaidAt);

        var d = Collab(S.Submitted); d.AutoApproveAt = Now.AddDays(1);
        UgcCollabStateMachine.Apply(d, S.Disputed, A.Creator, Now, Permissive);
        Assert.Null(d.AutoApproveAt);

        var x = Collab(S.Accepted);
        UgcCollabStateMachine.Apply(x, S.Cancelled, A.System, Now, Permissive, note: "Deadline passerad");
        Assert.Equal(Now, x.CancelledAt); Assert.Equal("Deadline passerad", x.CancelReason);
    }

    [Fact]
    public void Apply_records_an_event_and_refuses_bad_moves()
    {
        var c = Collab(S.Invited);
        var evt = UgcCollabStateMachine.Apply(c, S.Accepted, A.Creator, Now, Permissive, actorUserId: Guid.NewGuid(), note: "ok");
        Assert.Equal(S.Invited, evt.FromStatus);
        Assert.Equal(S.Accepted, evt.ToStatus);
        Assert.Equal(A.Creator, evt.Actor);
        Assert.Single(c.Events);

        var ex = Assert.Throws<UgcTransitionException>(() => UgcCollabStateMachine.Apply(c, S.Paid, A.System, Now, Permissive));
        Assert.Equal(S.Accepted, ex.From);
        Assert.Equal(S.Paid, ex.To);
        Assert.Equal(S.Accepted, c.Status);           // untouched
        Assert.Single(c.Events);                      // no event for a refused move
    }

    [Fact]
    public void Happy_path_with_one_revision_round()
    {
        var c = Collab(S.Invited);
        var ctx = Permissive;
        UgcCollabStateMachine.Apply(c, S.Accepted, A.Creator, Now, ctx);
        UgcCollabStateMachine.Apply(c, S.InProgress, A.Creator, Now.AddHours(1), ctx);
        UgcCollabStateMachine.Apply(c, S.Submitted, A.Creator, Now.AddDays(2), ctx);
        UgcCollabStateMachine.Apply(c, S.RevisionRequested, A.Brand, Now.AddDays(3), ctx);
        ctx = ctx with { RevisionCount = c.RevisionCount };
        UgcCollabStateMachine.Apply(c, S.Submitted, A.Creator, Now.AddDays(4), ctx);
        UgcCollabStateMachine.Apply(c, S.Approved, A.Brand, Now.AddDays(5), ctx);
        UgcCollabStateMachine.Apply(c, S.Paid, A.System, Now.AddDays(5).AddMinutes(1), ctx);

        Assert.Equal(S.Paid, c.Status);
        Assert.Equal(7, c.Events.Count);
        Assert.Equal(1, c.RevisionCount);
        Assert.True(UgcCollabStateMachine.IsTerminal(c.Status));
    }

    [Fact]
    public void NextStates_lists_only_what_the_actor_may_do()
    {
        Assert.Equal(new[] { S.RevisionRequested, S.Approved, S.Disputed }, UgcCollabStateMachine.NextStates(S.Submitted, A.Brand).OrderBy(x => x).ToArray());
        Assert.Equal(new[] { S.Paid }, UgcCollabStateMachine.NextStates(S.Approved, A.System).ToArray());
        Assert.Empty(UgcCollabStateMachine.NextStates(S.Approved, A.Brand));
    }

    // ── Application & campaign machines ──────────────────────────────

    [Theory]
    [InlineData(UgcApplicationStatus.Applied, UgcApplicationStatus.Preselected, A.Brand, true)]
    [InlineData(UgcApplicationStatus.Applied, UgcApplicationStatus.Hired, A.Brand, true)]
    [InlineData(UgcApplicationStatus.Applied, UgcApplicationStatus.Withdrawn, A.Creator, true)]
    [InlineData(UgcApplicationStatus.Applied, UgcApplicationStatus.Withdrawn, A.Brand, false)]
    [InlineData(UgcApplicationStatus.Preselected, UgcApplicationStatus.Hired, A.Brand, true)]
    [InlineData(UgcApplicationStatus.Hired, UgcApplicationStatus.Rejected, A.Brand, false)]
    [InlineData(UgcApplicationStatus.Rejected, UgcApplicationStatus.Applied, A.Creator, false)]
    [InlineData(UgcApplicationStatus.Applied, UgcApplicationStatus.Hired, A.Creator, false)]
    public void Application_transitions(UgcApplicationStatus from, UgcApplicationStatus to, A actor, bool allowed)
        => Assert.Equal(allowed, UgcApplicationStateMachine.Check(from, to, actor).Allowed);

    [Fact]
    public void Application_apply_stamps_decision()
    {
        var app = new UgcApplication { Status = UgcApplicationStatus.Applied, Pitch = "p" };
        UgcApplicationStateMachine.Apply(app, UgcApplicationStatus.Rejected, A.Brand, Now, "för dyr");
        Assert.Equal(Now, app.DecidedAt);
        Assert.Equal("för dyr", app.DecisionNote);
        Assert.Throws<InvalidOperationException>(() => UgcApplicationStateMachine.Apply(app, UgcApplicationStatus.Hired, A.Brand, Now));
    }

    [Fact]
    public void Campaign_publish_requires_org_number()
    {
        Assert.False(UgcCampaignStateMachine.Check(UgcCampaignStatus.Draft, UgcCampaignStatus.Published, A.Brand, brandHasOrgNumber: false).Allowed);
        Assert.True(UgcCampaignStateMachine.Check(UgcCampaignStatus.Draft, UgcCampaignStatus.Published, A.Brand, brandHasOrgNumber: true).Allowed);
        Assert.False(UgcCampaignStateMachine.Check(UgcCampaignStatus.Closed, UgcCampaignStatus.Published, A.Brand, true).Allowed);
        Assert.False(UgcCampaignStateMachine.Check(UgcCampaignStatus.Draft, UgcCampaignStatus.Published, A.Creator, true).Allowed);

        var c = new UgcCampaign { Status = UgcCampaignStatus.Draft, Title = "t", Goal = "g", Format = "f", CallToAction = "c" };
        UgcCampaignStateMachine.Apply(c, UgcCampaignStatus.Published, A.Brand, Now, true);
        Assert.Equal(Now, c.PublishedAt);
        UgcCampaignStateMachine.Apply(c, UgcCampaignStatus.Closed, A.System, Now.AddDays(1), true);
        Assert.Equal(Now.AddDays(1), c.ClosedAt);
    }
}
