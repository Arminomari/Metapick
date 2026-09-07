using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;

namespace CreatorPay.Domain.Ugc;

/// <summary>
/// Everything the machine needs to know beyond the current status. The
/// service builds this from what it has loaded; the machine stays pure.
/// </summary>
public sealed record UgcTransitionContext(
    bool BrandAccepted,
    bool CreatorAccepted,
    // Money is held for the collab. Ignored for product exchange.
    bool Funded,
    UgcCompensationType Compensation,
    int RevisionCount,
    int MaxRevisions,
    bool DisputeOpen,
    int AutoApproveDays = 5,
    int RevisionDeadlineDays = 3)
{
    /// <summary>Paid work needs money on hold; a product exchange does not.</summary>
    public bool FundedOrFree => Funded || Compensation == UgcCompensationType.ProductExchange;

    public static UgcTransitionContext From(UgcCollab c, bool funded, int autoApproveDays = 5, int revisionDeadlineDays = 3) =>
        new(c.BrandAcceptedAt != null, c.CreatorAcceptedAt != null, funded, c.Compensation,
            c.RevisionCount, c.MaxRevisions, c.Dispute?.Status == UgcDisputeStatus.Open,
            autoApproveDays, revisionDeadlineDays);
}

public sealed record UgcTransitionCheck(bool Allowed, string? Reason)
{
    public static readonly UgcTransitionCheck Ok = new(true, null);
    public static UgcTransitionCheck Deny(string reason) => new(false, reason);
}

public sealed class UgcTransitionException : InvalidOperationException
{
    public UgcCollabStatus From { get; }
    public UgcCollabStatus To { get; }
    public UgcActor Actor { get; }

    public UgcTransitionException(UgcCollabStatus from, UgcCollabStatus to, UgcActor actor, string reason)
        : base($"{from} → {to} by {actor}: {reason}")
    {
        From = from; To = to; Actor = actor;
    }
}

/// <summary>
/// The collab's life as an explicit table: which moves exist, who may make
/// them, and what must be true first. Services never write Status directly —
/// they call <see cref="Apply"/>, which validates, stamps the timestamps the
/// move implies, and returns the audit event.
/// </summary>
public static class UgcCollabStateMachine
{
    private static readonly UgcActor[] Anyone = [UgcActor.Brand, UgcActor.Creator, UgcActor.Admin, UgcActor.System];
    private static readonly UgcActor[] BothParties = [UgcActor.Brand, UgcActor.Creator];

    /// <summary>(from, to) → who may do it.</summary>
    private static readonly Dictionary<(UgcCollabStatus From, UgcCollabStatus To), UgcActor[]> Rules = new()
    {
        // Invitation: the creator's acceptance (or the funding that completes it) opens the job.
        [(UgcCollabStatus.Invited, UgcCollabStatus.Accepted)] = [UgcActor.Creator, UgcActor.System],
        [(UgcCollabStatus.Invited, UgcCollabStatus.Cancelled)] = Anyone,

        // Work
        [(UgcCollabStatus.Accepted, UgcCollabStatus.InProgress)] = [UgcActor.Creator, UgcActor.System],
        [(UgcCollabStatus.Accepted, UgcCollabStatus.Submitted)] = [UgcActor.Creator],
        [(UgcCollabStatus.Accepted, UgcCollabStatus.Cancelled)] = Anyone,
        [(UgcCollabStatus.InProgress, UgcCollabStatus.Submitted)] = [UgcActor.Creator],
        [(UgcCollabStatus.InProgress, UgcCollabStatus.Cancelled)] = Anyone,

        // Review
        [(UgcCollabStatus.Submitted, UgcCollabStatus.Approved)] = [UgcActor.Brand, UgcActor.System],
        [(UgcCollabStatus.Submitted, UgcCollabStatus.RevisionRequested)] = [UgcActor.Brand],
        [(UgcCollabStatus.Submitted, UgcCollabStatus.Disputed)] = BothParties,
        [(UgcCollabStatus.RevisionRequested, UgcCollabStatus.Submitted)] = [UgcActor.Creator],
        [(UgcCollabStatus.RevisionRequested, UgcCollabStatus.Cancelled)] = Anyone,
        [(UgcCollabStatus.RevisionRequested, UgcCollabStatus.Disputed)] = BothParties,

        // Money
        [(UgcCollabStatus.Approved, UgcCollabStatus.Paid)] = [UgcActor.System],

        // Dispute — only an admin leaves this state
        [(UgcCollabStatus.Disputed, UgcCollabStatus.Approved)] = [UgcActor.Admin],
        [(UgcCollabStatus.Disputed, UgcCollabStatus.Cancelled)] = [UgcActor.Admin],
    };

    public static bool IsTerminal(UgcCollabStatus s) => s is UgcCollabStatus.Paid or UgcCollabStatus.Cancelled;

    /// <summary>Every (from, to) pair the table knows — handy for exhaustive tests and diagrams.</summary>
    public static IEnumerable<(UgcCollabStatus From, UgcCollabStatus To, UgcActor[] Actors)> AllRules()
        => Rules.Select(kv => (kv.Key.From, kv.Key.To, kv.Value));

    /// <summary>States this actor could move to from here, before guards.</summary>
    public static IReadOnlyList<UgcCollabStatus> NextStates(UgcCollabStatus from, UgcActor actor)
        => Rules.Where(kv => kv.Key.From == from && kv.Value.Contains(actor)).Select(kv => kv.Key.To).ToList();

    /// <summary>Is this move allowed, and if not, why? Never throws.</summary>
    public static UgcTransitionCheck Check(UgcCollabStatus from, UgcCollabStatus to, UgcActor actor, UgcTransitionContext ctx)
    {
        if (from == to) return UgcTransitionCheck.Deny("Redan i det läget.");
        if (IsTerminal(from)) return UgcTransitionCheck.Deny($"{from} är slutgiltigt.");
        if (!Rules.TryGetValue((from, to), out var actors)) return UgcTransitionCheck.Deny($"Det finns ingen väg från {from} till {to}.");
        if (!actors.Contains(actor)) return UgcTransitionCheck.Deny($"{actor} får inte flytta {from} → {to}.");

        // ── Guards: what must be true before the move ──────────────
        switch (to)
        {
            case UgcCollabStatus.Accepted:
                if (!ctx.BrandAccepted) return UgcTransitionCheck.Deny("Företaget har inte accepterat kontraktet.");
                if (!ctx.CreatorAccepted) return UgcTransitionCheck.Deny("Creatorn har inte accepterat kontraktet.");
                if (!ctx.FundedOrFree) return UgcTransitionCheck.Deny("Betalningen är inte genomförd.");
                break;

            case UgcCollabStatus.Approved when from == UgcCollabStatus.Submitted:
                if (ctx.DisputeOpen) return UgcTransitionCheck.Deny("En tvist är öppen — bara admin kan avgöra.");
                break;

            case UgcCollabStatus.RevisionRequested:
                if (ctx.DisputeOpen) return UgcTransitionCheck.Deny("En tvist är öppen.");
                if (ctx.RevisionCount >= ctx.MaxRevisions)
                    return UgcTransitionCheck.Deny($"Max {ctx.MaxRevisions} revisionsrundor är använda — godkänn, eller öppna en tvist.");
                break;

            case UgcCollabStatus.Disputed:
                if (ctx.DisputeOpen) return UgcTransitionCheck.Deny("En tvist är redan öppen.");
                break;
        }

        return UgcTransitionCheck.Ok;
    }

    /// <summary>
    /// Perform the move: validate, stamp what the move implies, return the audit
    /// event. Throws <see cref="UgcTransitionException"/> when the table says no.
    /// The event is also added to <c>collab.Events</c>; because every entity
    /// carries a pre-set Guid key, EF will not discover it as new through the
    /// navigation — the caller must Add the returned event to its repository.
    /// </summary>
    public static UgcCollabEvent Apply(UgcCollab collab, UgcCollabStatus to, UgcActor actor, DateTime now,
        UgcTransitionContext ctx, Guid? actorUserId = null, string? note = null)
    {
        var from = collab.Status;
        var check = Check(from, to, actor, ctx);
        if (!check.Allowed) throw new UgcTransitionException(from, to, actor, check.Reason!);

        switch (to)
        {
            case UgcCollabStatus.Accepted:
                collab.DeadlineAt ??= UgcSchedule.DeadlineFromAcceptance(now, collab.DeadlineDays);
                break;

            case UgcCollabStatus.Submitted:
                collab.SubmittedAt = now;
                collab.AutoApproveAt = UgcSchedule.AutoApproveAt(now, ctx.AutoApproveDays);
                collab.AutoApproveReminderSentAt = null;
                break;

            case UgcCollabStatus.RevisionRequested:
                collab.RevisionCount += 1;
                collab.AutoApproveAt = null;
                // Each round gets a fresh, shorter clock — and fresh reminders.
                collab.DeadlineAt = UgcSchedule.RevisionDeadline(now, ctx.RevisionDeadlineDays);
                collab.DeadlineReminder48hSentAt = null;
                collab.DeadlineReminder24hSentAt = null;
                break;

            case UgcCollabStatus.Approved:
                collab.ApprovedAt = now;
                collab.AutoApproveAt = null;
                break;

            case UgcCollabStatus.Paid:
                collab.PaidAt = now;
                break;

            case UgcCollabStatus.Cancelled:
                collab.CancelledAt = now;
                collab.CancelReason ??= note;
                collab.AutoApproveAt = null;
                break;

            case UgcCollabStatus.Disputed:
                // Freeze the clock; the admin decides.
                collab.AutoApproveAt = null;
                break;
        }

        collab.Status = to;

        var evt = new UgcCollabEvent
        {
            CollabId = collab.Id,
            FromStatus = from,
            ToStatus = to,
            Actor = actor,
            ActorUserId = actorUserId,
            Note = note,
            CreatedAt = now,
            UpdatedAt = now,
        };
        collab.Events.Add(evt);
        return evt;
    }
}

/// <summary>Bids: Applied → Preselected → Hired, or out via Rejected / Withdrawn.</summary>
public static class UgcApplicationStateMachine
{
    private static readonly Dictionary<(UgcApplicationStatus, UgcApplicationStatus), UgcActor[]> Rules = new()
    {
        [(UgcApplicationStatus.Applied, UgcApplicationStatus.Preselected)] = [UgcActor.Brand],
        [(UgcApplicationStatus.Applied, UgcApplicationStatus.Hired)] = [UgcActor.Brand],
        [(UgcApplicationStatus.Applied, UgcApplicationStatus.Rejected)] = [UgcActor.Brand, UgcActor.System],
        [(UgcApplicationStatus.Applied, UgcApplicationStatus.Withdrawn)] = [UgcActor.Creator],
        [(UgcApplicationStatus.Preselected, UgcApplicationStatus.Hired)] = [UgcActor.Brand],
        [(UgcApplicationStatus.Preselected, UgcApplicationStatus.Rejected)] = [UgcActor.Brand, UgcActor.System],
        [(UgcApplicationStatus.Preselected, UgcApplicationStatus.Withdrawn)] = [UgcActor.Creator],
    };

    public static bool IsTerminal(UgcApplicationStatus s)
        => s is UgcApplicationStatus.Hired or UgcApplicationStatus.Rejected or UgcApplicationStatus.Withdrawn;

    public static UgcTransitionCheck Check(UgcApplicationStatus from, UgcApplicationStatus to, UgcActor actor)
    {
        if (from == to) return UgcTransitionCheck.Deny("Redan i det läget.");
        if (IsTerminal(from)) return UgcTransitionCheck.Deny($"{from} är slutgiltigt.");
        if (!Rules.TryGetValue((from, to), out var actors)) return UgcTransitionCheck.Deny($"Ingen väg från {from} till {to}.");
        if (!actors.Contains(actor)) return UgcTransitionCheck.Deny($"{actor} får inte flytta {from} → {to}.");
        return UgcTransitionCheck.Ok;
    }

    public static void Apply(UgcApplication app, UgcApplicationStatus to, UgcActor actor, DateTime now, string? note = null)
    {
        var check = Check(app.Status, to, actor);
        if (!check.Allowed) throw new InvalidOperationException($"{app.Status} → {to} by {actor}: {check.Reason}");
        app.Status = to;
        if (IsTerminal(to)) { app.DecidedAt = now; app.DecisionNote ??= note; }
    }
}

/// <summary>Campaigns: Draft → Published → Closed. A draft can be closed (dropped) too.</summary>
public static class UgcCampaignStateMachine
{
    private static readonly Dictionary<(UgcCampaignStatus, UgcCampaignStatus), UgcActor[]> Rules = new()
    {
        [(UgcCampaignStatus.Draft, UgcCampaignStatus.Published)] = [UgcActor.Brand],
        [(UgcCampaignStatus.Draft, UgcCampaignStatus.Closed)] = [UgcActor.Brand, UgcActor.Admin],
        [(UgcCampaignStatus.Published, UgcCampaignStatus.Closed)] = [UgcActor.Brand, UgcActor.Admin, UgcActor.System],
    };

    public static UgcTransitionCheck Check(UgcCampaignStatus from, UgcCampaignStatus to, UgcActor actor, bool brandHasOrgNumber)
    {
        if (from == to) return UgcTransitionCheck.Deny("Redan i det läget.");
        if (from == UgcCampaignStatus.Closed) return UgcTransitionCheck.Deny("Kampanjen är stängd.");
        if (!Rules.TryGetValue((from, to), out var actors)) return UgcTransitionCheck.Deny($"Ingen väg från {from} till {to}.");
        if (!actors.Contains(actor)) return UgcTransitionCheck.Deny($"{actor} får inte flytta {from} → {to}.");
        if (to == UgcCampaignStatus.Published && !brandHasOrgNumber)
            return UgcTransitionCheck.Deny("Företaget måste ha organisationsnummer registrerat för att beställa.");
        return UgcTransitionCheck.Ok;
    }

    public static void Apply(UgcCampaign campaign, UgcCampaignStatus to, UgcActor actor, DateTime now, bool brandHasOrgNumber)
    {
        var check = Check(campaign.Status, to, actor, brandHasOrgNumber);
        if (!check.Allowed) throw new InvalidOperationException($"{campaign.Status} → {to} by {actor}: {check.Reason}");
        campaign.Status = to;
        if (to == UgcCampaignStatus.Published) campaign.PublishedAt = now;
        if (to == UgcCampaignStatus.Closed) campaign.ClosedAt = now;
    }
}
