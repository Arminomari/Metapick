using CreatorPay.Application.Interfaces;
using CreatorPay.Application.Ugc;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Infrastructure.Data;
using CreatorPay.Infrastructure.Repositories;
using CreatorPay.Worker.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace CreatorPay.Tests.Ugc;

/// <summary>
/// The two clocks that move money without a human: no-show and auto-approve.
/// Run against an in-memory AppDbContext with a scripted gateway, and every
/// scenario is run twice — the second run must be a no-op.
/// </summary>
public class UgcJobsTests
{
    private static readonly DateTime Now = new(2026, 9, 8, 12, 0, 0, DateTimeKind.Utc);

    // ── Fakes ────────────────────────────────────────────────────────

    private sealed class FakeNotifications : INotificationService
    {
        public List<(Guid User, NotificationType Type, string Message)> Sent { get; } = [];
        public Task SendAsync(Guid recipientId, NotificationType type, string message, Guid? referenceId = null)
        { Sent.Add((recipientId, type, message)); return Task.CompletedTask; }
        public Task<Application.Common.Result<Application.Common.PagedResult<Application.DTOs.NotificationDto>>> GetNotificationsAsync(Guid userId, bool? unreadOnly, int page, int pageSize) => throw new NotImplementedException();
        public Task<Application.Common.Result<bool>> MarkAsReadAsync(Guid notificationId, Guid userId) => throw new NotImplementedException();
        public Task<Application.Common.Result<bool>> MarkAllReadAsync(Guid userId) => throw new NotImplementedException();
    }

    /// <summary>The jobs swallow per-row exceptions by design; the tests must not.</summary>
    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Errors { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (logLevel >= LogLevel.Warning)
                Errors.Add($"{logLevel}: {formatter(state, exception)}{(exception != null ? " :: " + exception : "")}");
        }
    }

    private sealed class FakeGateway : IUgcPaymentGateway
    {
        public bool Succeed { get; set; } = true;
        public int Transfers { get; private set; }
        public int Refunds { get; private set; }
        public long LastTransferOre { get; private set; }
        public long LastRefundOre { get; private set; }
        public bool IsConfigured => true;

        public Task<UgcGatewayResult> HoldAsync(Guid collabId, long brandTotalOre, string currency, string brandUserEmail, CancellationToken ct = default)
            => Task.FromResult(UgcGatewayResult.Ok("pi_test"));
        public Task<UgcGatewayResult> TransferAsync(Guid collabId, string chargeId, long amountOre, string currency, string connectedAccountId, CancellationToken ct = default)
        { Transfers++; LastTransferOre = amountOre; return Task.FromResult(Succeed ? UgcGatewayResult.Ok("tr_" + Transfers) : UgcGatewayResult.Fail("stripe down")); }
        public Task<UgcGatewayResult> RefundAsync(Guid collabId, string paymentIntentId, long amountOre, CancellationToken ct = default)
        { Refunds++; LastRefundOre = amountOre; return Task.FromResult(Succeed ? UgcGatewayResult.Ok("re_" + Refunds) : UgcGatewayResult.Fail("stripe down")); }
        public Task<UgcGatewayResult> CreateConnectOnboardingAsync(Guid creatorProfileId, string email, string returnUrl, string refreshUrl, CancellationToken ct = default)
            => Task.FromResult(UgcGatewayResult.Ok("acct_test", "https://connect.stripe.com/x"));
    }

    // ── World builder ────────────────────────────────────────────────

    private sealed class World : IDisposable
    {
        public AppDbContext Db { get; }
        public FakeNotifications Notifications { get; } = new();
        public FakeGateway Gateway { get; } = new();
        public UgcSettings Settings { get; } = new();
        public CapturingLogger<UgcDeadlineJob> DeadlineLog { get; } = new();
        public CapturingLogger<UgcAutoApproveJob> AutoApproveLog { get; } = new();
        public CapturingLogger<UgcSettlementService> SettlementLog { get; } = new();
        public IEnumerable<string> Errors => DeadlineLog.Errors.Concat(AutoApproveLog.Errors).Concat(SettlementLog.Errors);
        public User BrandUser { get; }
        public User CreatorUser { get; }
        public BrandProfile Brand { get; }
        public CreatorProfile Creator { get; }
        public UgcCreatorProfile UgcCreator { get; }

        public World()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase("ugc-jobs-" + Guid.NewGuid())
                .Options;
            Db = new AppDbContext(options);

            BrandUser = new User { Email = "brand@test.se", PasswordHash = "x", FirstName = "B", LastName = "B", Role = UserRole.Brand, Status = UserStatus.Active };
            CreatorUser = new User { Email = "creator@test.se", PasswordHash = "x", FirstName = "C", LastName = "C", Role = UserRole.Creator, Status = UserStatus.Active };
            Brand = new BrandProfile { UserId = BrandUser.Id, CompanyName = "Bar AB", OrganizationNumber = "556677-8899", Industry = "Mat", Country = "SE", Status = BrandStatus.Approved };
            Creator = new CreatorProfile { UserId = CreatorUser.Id, DisplayName = "Gustav", Category = "Mat", Country = "SE", Status = CreatorStatus.Approved };
            UgcCreator = new UgcCreatorProfile { CreatorProfileId = Creator.Id, Status = UgcCreatorStatus.Approved, StripeConnectAccountId = "acct_1", PayoutOnboardingComplete = true };

            Db.AddRange(BrandUser, CreatorUser, Brand, Creator, UgcCreator);
            Db.SaveChanges();
        }

        public UgcCollab AddCollab(UgcCollabStatus status, Action<UgcCollab>? tweak = null, bool held = true)
        {
            var c = new UgcCollab
            {
                BrandProfileId = Brand.Id, CreatorProfileId = Creator.Id, Title = "Lunchvideo", BriefSnapshot = "brief",
                Compensation = UgcCompensationType.Paid, AgreedAmountOre = 100_000, PlatformFeeOre = 15_000, BrandTotalOre = 115_000, FeePercentApplied = 15,
                RightsPackage = UgcRightsPackage.Organic, DeadlineDays = 7, MaxRevisions = 2,
                ContractText = "c", ContractHash = "h", ContractTemplateVersion = "v",
                BrandAcceptedAt = Now.AddDays(-3), CreatorAcceptedAt = Now.AddDays(-3),
                Status = status,
            };
            if (held)
                c.Payment = new UgcPayment { CollabId = c.Id, Status = UgcPaymentStatus.Held, PaymentIntentId = "pi_1", ChargeId = "ch_1", BrandPaidOre = 115_000, CreatorAmountOre = 100_000, PlatformFeeOre = 15_000, HeldAt = Now.AddDays(-3) };
            tweak?.Invoke(c);
            Db.Add(c);
            Db.SaveChanges();
            return c;
        }

        private UgcSettlementService Settlement() =>
            new(Gateway, new Repository<UgcPayment>(Db), new Repository<UgcCollabEvent>(Db), SettlementLog);

        public UgcDeadlineJob DeadlineJob() => new(DeadlineLog,
            new Repository<UgcCollab>(Db), new Repository<UgcCreatorProfile>(Db), new Repository<UgcCollabEvent>(Db), new UnitOfWork(Db),
            Notifications, Settlement(), Settings);

        public UgcAutoApproveJob AutoApproveJob() => new(AutoApproveLog,
            new Repository<UgcCollab>(Db), new Repository<UgcCreatorProfile>(Db), new Repository<UgcCollabEvent>(Db), new UnitOfWork(Db),
            Notifications, Settlement(), Settings);

        /// <summary>Fails the test with the job's own error text — no silent swallowing.</summary>
        public void AssertNoErrors(params string[] expectedWarnings)
        {
            var unexpected = Errors.Where(e => !expectedWarnings.Any(e.Contains)).ToList();
            Assert.True(unexpected.Count == 0, string.Join("\n---\n", unexpected));
        }

        public UgcCollab Reload(Guid id)
        {
            Db.ChangeTracker.Clear();
            return Db.UgcCollabs.Include(c => c.Payment).Include(c => c.Events).First(c => c.Id == id);
        }

        public UgcCreatorProfile ReloadCreator()
        {
            Db.ChangeTracker.Clear();
            return Db.UgcCreatorProfiles.First(p => p.Id == UgcCreator.Id);
        }

        public void Dispose() => Db.Dispose();
    }

    // ── No-show ──────────────────────────────────────────────────────

    [Fact]
    public async Task NoShow_cancels_refunds_strikes_and_is_idempotent()
    {
        using var w = new World();
        var c = w.AddCollab(UgcCollabStatus.InProgress, x => x.DeadlineAt = Now.AddHours(-1));

        await w.DeadlineJob().ExecuteAsync(Now, CancellationToken.None);
        w.AssertNoErrors();

        var after = w.Reload(c.Id);
        Assert.Equal(UgcCollabStatus.Cancelled, after.Status);
        Assert.True(after.NoShow);
        Assert.Equal(Now, after.CancelledAt);
        Assert.Equal(UgcPaymentStatus.Refunded, after.Payment!.Status);
        Assert.Equal(115_000, after.Payment.RefundedOre);       // fee included: nothing was delivered
        Assert.Equal(1, w.Gateway.Refunds);
        Assert.Equal(1, w.ReloadCreator().Strikes);
        Assert.Single(after.Events);
        Assert.Equal(2, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcCancelled));

        // Second run: same world, nothing moves.
        await w.DeadlineJob().ExecuteAsync(Now.AddHours(1), CancellationToken.None);
        var again = w.Reload(c.Id);
        Assert.Equal(1, w.Gateway.Refunds);
        Assert.Equal(1, w.ReloadCreator().Strikes);
        Assert.Single(again.Events);
        Assert.Equal(2, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcCancelled));
    }

    [Fact]
    public async Task Third_strike_suspends()
    {
        using var w = new World();
        w.UgcCreator.Strikes = 2; w.Db.SaveChanges();
        w.AddCollab(UgcCollabStatus.Accepted, x => x.DeadlineAt = Now.AddMinutes(-5));

        await w.DeadlineJob().ExecuteAsync(Now, CancellationToken.None);

        var creator = w.ReloadCreator();
        Assert.Equal(3, creator.Strikes);
        Assert.Equal(UgcCreatorStatus.Suspended, creator.Status);
        Assert.Equal(Now, creator.SuspendedAt);
        Assert.Contains(w.Notifications.Sent, n => n.User == w.CreatorUser.Id && n.Message.Contains("avstängt"));
    }

    [Fact]
    public async Task NoShow_with_provider_down_still_cancels_and_keeps_the_reason()
    {
        using var w = new World();
        w.Gateway.Succeed = false;
        var c = w.AddCollab(UgcCollabStatus.RevisionRequested, x => x.DeadlineAt = Now.AddHours(-2));

        await w.DeadlineJob().ExecuteAsync(Now, CancellationToken.None);

        var after = w.Reload(c.Id);
        Assert.Equal(UgcCollabStatus.Cancelled, after.Status);
        Assert.Equal(UgcPaymentStatus.Held, after.Payment!.Status);    // money not moved yet
        Assert.Equal("stripe down", after.Payment.LastError);
    }

    [Fact]
    public async Task NoShow_on_product_exchange_needs_no_refund()
    {
        using var w = new World();
        var c = w.AddCollab(UgcCollabStatus.Accepted, x => { x.Compensation = UgcCompensationType.ProductExchange; x.DeadlineAt = Now.AddHours(-1); }, held: false);

        await w.DeadlineJob().ExecuteAsync(Now, CancellationToken.None);

        Assert.Equal(UgcCollabStatus.Cancelled, w.Reload(c.Id).Status);
        Assert.Equal(0, w.Gateway.Refunds);
    }

    // ── Deadline reminders ───────────────────────────────────────────

    [Fact]
    public async Task Deadline_reminders_fire_once_each()
    {
        using var w = new World();
        var c = w.AddCollab(UgcCollabStatus.Accepted, x => x.DeadlineAt = Now.AddHours(30));

        await w.DeadlineJob().ExecuteAsync(Now, CancellationToken.None);
        Assert.Equal(1, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcDeadlineReminder));
        Assert.NotNull(w.Reload(c.Id).DeadlineReminder48hSentAt);

        await w.DeadlineJob().ExecuteAsync(Now.AddHours(1), CancellationToken.None);
        Assert.Equal(1, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcDeadlineReminder));

        await w.DeadlineJob().ExecuteAsync(Now.AddHours(10), CancellationToken.None);   // 20 h left
        Assert.Equal(2, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcDeadlineReminder));
        Assert.NotNull(w.Reload(c.Id).DeadlineReminder24hSentAt);

        await w.DeadlineJob().ExecuteAsync(Now.AddHours(11), CancellationToken.None);
        Assert.Equal(2, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcDeadlineReminder));
        Assert.Equal(UgcCollabStatus.Accepted, w.Reload(c.Id).Status);
    }

    // ── Auto-approve ─────────────────────────────────────────────────

    [Fact]
    public async Task AutoApprove_approves_pays_and_is_idempotent()
    {
        using var w = new World();
        var c = w.AddCollab(UgcCollabStatus.Submitted, x => { x.SubmittedAt = Now.AddDays(-5); x.DeadlineAt = Now.AddDays(-4); x.AutoApproveAt = Now.AddMinutes(-1); });

        await w.AutoApproveJob().ExecuteAsync(Now, CancellationToken.None);
        w.AssertNoErrors();

        var after = w.Reload(c.Id);
        Assert.Equal(UgcCollabStatus.Paid, after.Status);
        Assert.Equal(Now, after.ApprovedAt);
        Assert.Equal(Now, after.PaidAt);
        Assert.Equal(UgcPaymentStatus.Transferred, after.Payment!.Status);
        Assert.Equal(100_000, after.Payment.TransferredOre);       // the creator's amount, never the fee
        Assert.Equal(1, w.Gateway.Transfers);
        Assert.Equal(2, after.Events.Count);                       // Approved, Paid
        var creator = w.ReloadCreator();
        Assert.Equal(1, creator.DeliveredCount);
        Assert.Equal(1, creator.OnTimeCount);                      // submitted a day before the deadline
        Assert.Equal(0, creator.LateCount);
        Assert.Contains(w.Notifications.Sent, n => n.Type == NotificationType.UgcPaid);

        await w.AutoApproveJob().ExecuteAsync(Now.AddHours(1), CancellationToken.None);
        Assert.Equal(1, w.Gateway.Transfers);
        Assert.Equal(2, w.Reload(c.Id).Events.Count);
        Assert.Equal(1, w.ReloadCreator().DeliveredCount);
    }

    [Fact]
    public async Task AutoApprove_waits_while_a_dispute_is_open()
    {
        using var w = new World();
        var c = w.AddCollab(UgcCollabStatus.Submitted, x =>
        {
            x.AutoApproveAt = Now.AddDays(-1);
            x.Dispute = new UgcDispute { CollabId = x.Id, OpenedByUserId = w.BrandUser.Id, OpenedBy = UgcActor.Brand, Reason = "Fel produkt", Status = UgcDisputeStatus.Open };
        });

        await w.AutoApproveJob().ExecuteAsync(Now, CancellationToken.None);

        Assert.Equal(UgcCollabStatus.Submitted, w.Reload(c.Id).Status);
        Assert.Equal(0, w.Gateway.Transfers);
        Assert.Empty(w.Notifications.Sent);
    }

    [Fact]
    public async Task Transfer_failure_leaves_Approved_and_the_next_run_retries()
    {
        using var w = new World();
        w.Gateway.Succeed = false;
        var c = w.AddCollab(UgcCollabStatus.Submitted, x => { x.SubmittedAt = Now.AddDays(-5); x.DeadlineAt = Now; x.AutoApproveAt = Now.AddMinutes(-1); });

        await w.AutoApproveJob().ExecuteAsync(Now, CancellationToken.None);
        var mid = w.Reload(c.Id);
        Assert.Equal(UgcCollabStatus.Approved, mid.Status);
        Assert.Equal("stripe down", mid.Payment!.LastError);
        Assert.Equal(1, w.Gateway.Transfers);

        w.Gateway.Succeed = true;
        await w.AutoApproveJob().ExecuteAsync(Now.AddHours(1), CancellationToken.None);
        w.AssertNoErrors("stripe down");
        var done = w.Reload(c.Id);
        Assert.Equal(UgcCollabStatus.Paid, done.Status);
        Assert.Null(done.Payment!.LastError);
        Assert.Equal(2, w.Gateway.Transfers);
        Assert.Equal(1, w.ReloadCreator().DeliveredCount);        // recorded once, at approval
    }

    [Fact]
    public async Task Product_exchange_settles_without_a_gateway()
    {
        using var w = new World();
        var c = w.AddCollab(UgcCollabStatus.Submitted, x => { x.Compensation = UgcCompensationType.ProductExchange; x.AutoApproveAt = Now.AddMinutes(-1); }, held: false);

        await w.AutoApproveJob().ExecuteAsync(Now, CancellationToken.None);
        w.AssertNoErrors();

        var after = w.Reload(c.Id);
        Assert.Equal(UgcCollabStatus.Paid, after.Status);
        Assert.Equal(UgcPaymentStatus.NotApplicable, after.Payment!.Status);
        Assert.Equal(0, w.Gateway.Transfers);
    }

    [Fact]
    public async Task Review_reminder_fires_once_and_never_after_the_clock()
    {
        using var w = new World();
        var c = w.AddCollab(UgcCollabStatus.Submitted, x => x.AutoApproveAt = Now.AddHours(20));

        await w.AutoApproveJob().ExecuteAsync(Now, CancellationToken.None);
        Assert.Equal(1, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcAutoApproveReminder));
        Assert.Equal(UgcCollabStatus.Submitted, w.Reload(c.Id).Status);

        await w.AutoApproveJob().ExecuteAsync(Now.AddHours(2), CancellationToken.None);
        Assert.Equal(1, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcAutoApproveReminder));

        await w.AutoApproveJob().ExecuteAsync(Now.AddHours(21), CancellationToken.None);   // clock passed
        Assert.Equal(UgcCollabStatus.Paid, w.Reload(c.Id).Status);
        Assert.Equal(1, w.Notifications.Sent.Count(n => n.Type == NotificationType.UgcAutoApproveReminder));
    }
}
