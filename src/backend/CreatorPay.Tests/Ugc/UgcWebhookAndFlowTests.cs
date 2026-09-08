using CreatorPay.Application.Interfaces;
using CreatorPay.Application.Ugc;
using CreatorPay.Application.Ugc.Services;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Ugc;
using CreatorPay.Infrastructure.Data;
using CreatorPay.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace CreatorPay.Tests.Ugc;

/// <summary>
/// Phase 2 end to end on an in-memory database: the real services, a scripted
/// gateway, an in-memory file store. Proves the wiring (hire → contract →
/// payment webhook → acceptance → delivery → approval → transfer) and that a
/// webhook delivered twice changes nothing the second time.
/// </summary>
public class UgcWebhookAndFlowTests
{
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

    private sealed class FakeGateway : IUgcPaymentGateway
    {
        public int Checkouts, Transfers, Refunds;
        public long LastTransferOre, LastRefundOre;
        public bool IsConfigured => true;
        public Task<UgcGatewayResult> CreateCheckoutAsync(UgcCheckoutRequest request, CancellationToken ct = default)
        { Checkouts++; return Task.FromResult(UgcGatewayResult.Ok("cs_" + Checkouts, "https://checkout.stripe.com/c/" + Checkouts)); }
        public Task<UgcGatewayResult> TransferAsync(Guid collabId, string chargeId, long amountOre, string currency, string connectedAccountId, CancellationToken ct = default)
        { Transfers++; LastTransferOre = amountOre; return Task.FromResult(UgcGatewayResult.Ok("tr_" + Transfers)); }
        public Task<UgcGatewayResult> RefundAsync(Guid collabId, string paymentIntentId, long amountOre, CancellationToken ct = default)
        { Refunds++; LastRefundOre = amountOre; return Task.FromResult(UgcGatewayResult.Ok("re_" + Refunds)); }
        public Task<UgcGatewayResult> CreateConnectOnboardingAsync(Guid creatorProfileId, string? existingAccountId, string email, string returnUrl, string refreshUrl, CancellationToken ct = default)
            => Task.FromResult(UgcGatewayResult.Ok(existingAccountId ?? "acct_new", "https://connect.stripe.com/x"));
        public Task<UgcConnectStatus> GetConnectStatusAsync(string connectedAccountId, CancellationToken ct = default)
            => Task.FromResult(new UgcConnectStatus(true, true, true, true, null));
    }

    private sealed class MemoryFileStore : IUgcFileStore
    {
        public Dictionary<string, long> Files { get; } = [];
        public bool IsCloud => false;
        public Task<UgcStoredFile> SaveAsync(Stream content, string fileName, string contentType, Guid collabId, int version, CancellationToken ct = default)
        { var key = $"{collabId:N}/v{version}{Path.GetExtension(fileName)}"; Files[key] = content.Length; return Task.FromResult(new UgcStoredFile(key, content.Length, contentType)); }
        public Task<string> GetUrlAsync(string key, CancellationToken ct = default) => Task.FromResult("https://files.test/" + key);
        public Task DeleteAsync(string key, CancellationToken ct = default) { Files.Remove(key); return Task.CompletedTask; }
    }

    private sealed class FakeTikTok : ITikTokApiClient
    {
        public Task<TikTokAuthResult> ExchangeCodeForTokenAsync(string code, string redirectUri, string codeVerifier) => throw new NotImplementedException();
        public Task<TikTokTokenRefreshResult> RefreshTokenAsync(string refreshToken) => throw new NotImplementedException();
        public Task<TikTokUserInfo> GetUserInfoAsync(string accessToken) => throw new NotImplementedException();
        public Task<List<TikTokVideo>> GetUserVideosAsync(string accessToken, DateTime? since, int maxResults = 50) => Task.FromResult(new List<TikTokVideo>());
    }

    private sealed class FakeEncryption : IEncryptionService
    {
        public string HashPassword(string password) => password;
        public bool VerifyPassword(string password, string hash) => password == hash;
        public string Encrypt(string plainText) => plainText;
        public string Decrypt(string cipherText) => cipherText;
    }

    private sealed class FakeAudit : IAuditService
    {
        public Task LogAsync(Guid userId, string action, string? entityType, Guid? entityId) => Task.CompletedTask;
        public Task<Application.Common.Result<Application.Common.PagedResult<Application.DTOs.AuditLogDto>>> GetAuditLogsAsync(string? entityType, Guid? entityId, Guid? userId, int page, int pageSize) => throw new NotImplementedException();
    }

    // ── World ────────────────────────────────────────────────────────

    private sealed class World : IDisposable
    {
        public AppDbContext Db { get; }
        public FakeNotifications Notifications { get; } = new();
        public FakeGateway Gateway { get; } = new();
        public MemoryFileStore Files { get; } = new();
        public UgcSettings Settings { get; } = new();
        public IConfiguration Config { get; } = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Frontend:BaseUrl"] = "https://www.vyrle.co" }).Build();

        public User BrandUser { get; }
        public User CreatorUser { get; }
        public User AdminUser { get; }
        public BrandProfile Brand { get; }
        public CreatorProfile Creator { get; }
        public UgcCreatorProfile UgcCreator { get; }

        public World()
        {
            Db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase("ugc-flow-" + Guid.NewGuid()).Options);
            BrandUser = new User { Email = "brand@test.se", PasswordHash = "x", FirstName = "B", LastName = "B", Role = UserRole.Brand, Status = UserStatus.Active };
            CreatorUser = new User { Email = "creator@test.se", PasswordHash = "x", FirstName = "Gustav", LastName = "L", Role = UserRole.Creator, Status = UserStatus.Active };
            AdminUser = new User { Email = "admin@test.se", PasswordHash = "x", FirstName = "A", LastName = "A", Role = UserRole.Admin, Status = UserStatus.Active };
            Brand = new BrandProfile { UserId = BrandUser.Id, CompanyName = "Sushi Söder AB", OrganizationNumber = "556677-8899", Industry = "Mat", Country = "SE", Status = BrandStatus.Approved };
            Creator = new CreatorProfile { UserId = CreatorUser.Id, DisplayName = "Gustav", Category = "Mat", Country = "SE", Status = CreatorStatus.Approved, FollowerCount = 5000 };
            UgcCreator = new UgcCreatorProfile { CreatorProfileId = Creator.Id, Status = UgcCreatorStatus.Approved, StripeConnectAccountId = "acct_1", PayoutOnboardingComplete = true, Region = "Stockholm" };
            Db.AddRange(BrandUser, CreatorUser, AdminUser, Brand, Creator, UgcCreator);
            Db.SaveChanges();
        }

        private Repository<T> R<T>() where T : Domain.Common.BaseEntity => new(Db);
        private UnitOfWork Uow => new(Db);
        private UgcSettlementService Settlement => new(Gateway, R<UgcPayment>(), R<UgcCollabEvent>(), NullLogger<UgcSettlementService>.Instance);

        public IUgcCreatorService CreatorService => new UgcCreatorService(R<CreatorProfile>(), R<UgcCreatorProfile>(), R<PortfolioItem>(), Uow, new FakeTikTok(), new FakeEncryption(), Gateway, Settings, Config, NullLogger<UgcCreatorService>.Instance);
        public IUgcCollabService CollabService => new UgcCollabService(R<UgcCollab>(), R<UgcCollabEvent>(), R<UgcPayment>(), R<UgcDeliverable>(), R<UgcDispute>(), R<UgcMessage>(), R<UgcCreatorProfile>(), R<BrandProfile>(), R<CreatorProfile>(), R<User>(), Uow, Notifications, Gateway, Files, Settlement, Settings, Config, NullLogger<UgcCollabService>.Instance);
        public IUgcCampaignService CampaignService => new UgcCampaignService(R<UgcCampaign>(), R<UgcApplication>(), R<UgcCollab>(), R<BrandProfile>(), R<CreatorProfile>(), R<UgcCreatorProfile>(), Uow, Notifications, new UnconfiguredUgcBriefGenerator(), NullLogger<UgcCampaignService>.Instance);
        public IUgcApplicationService ApplicationService => new UgcApplicationService(R<UgcApplication>(), R<UgcCampaign>(), R<UgcCollab>(), R<BrandProfile>(), R<CreatorProfile>(), R<UgcCreatorProfile>(), Uow, Notifications, CreatorService, CollabService, Settings, NullLogger<UgcApplicationService>.Instance);
        public IUgcWebhookService Webhooks => new UgcWebhookService(R<UgcWebhookEvent>(), R<UgcCollab>(), R<UgcPayment>(), R<UgcCollabEvent>(), R<UgcCreatorProfile>(), Uow, Notifications, Gateway, Settings, NullLogger<UgcWebhookService>.Instance);
        public IUgcAdminService AdminService => new UgcAdminService(R<UgcCreatorProfile>(), R<UgcCollab>(), R<UgcCollabEvent>(), R<UgcDispute>(), R<UgcCampaign>(), R<UgcPayment>(), Uow, Notifications, new FakeAudit(), Settlement, Webhooks, CollabService, Gateway, Files, new UnconfiguredUgcBriefGenerator(), Settings, NullLogger<UgcAdminService>.Instance);

        public UgcCollab Reload(Guid id)
        {
            Db.ChangeTracker.Clear();
            return Db.UgcCollabs.Include(c => c.Payment).Include(c => c.Events).Include(c => c.Deliverables).Include(c => c.Dispute).First(c => c.Id == id);
        }

        public void Dispose() => Db.Dispose();
    }

    private static UpsertUgcCampaignRequest Campaign(string comp = "Paid", long min = 100_000, long max = 200_000) => new(
        "Lunchdeal-video",
        new UgcBriefDto("Fler lunchgäster", "9:16 TikTok", 30, 1, ["Visste du att…"], "Boka via länken", [], ["Visa menyn"], ["Ingen copyright-musik"], null),
        "Stockholm", ["Mat"], 1000, null, comp, min, max, comp == "Paid" ? null : "Lunch för två", comp == "Paid" ? null : 30_000, "OrganicPlusAds6M", 7, 1);

    // ── Webhook idempotency ──────────────────────────────────────────

    [Fact]
    public async Task Same_event_id_runs_the_handler_once()
    {
        using var w = new World();
        var runs = 0;
        Task Handler(CancellationToken _) { runs++; return Task.CompletedTask; }

        Assert.True(await w.Webhooks.ProcessOnceAsync("stripe", "evt_1", "payment_intent.succeeded", Handler));
        Assert.False(await w.Webhooks.ProcessOnceAsync("stripe", "evt_1", "payment_intent.succeeded", Handler));
        Assert.False(await w.Webhooks.ProcessOnceAsync("stripe", "evt_1", "payment_intent.succeeded", Handler));
        Assert.True(await w.Webhooks.ProcessOnceAsync("stripe", "evt_2", "payment_intent.succeeded", Handler));
        Assert.Equal(2, runs);

        w.Db.ChangeTracker.Clear();
        var rows = w.Db.UgcWebhookEvents.ToList();
        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.NotNull(r.ProcessedAt));
    }

    [Fact]
    public async Task A_failing_handler_releases_the_claim_so_the_retry_can_run()
    {
        using var w = new World();
        var attempts = 0;
        Task Flaky(CancellationToken _) { attempts++; return attempts == 1 ? throw new InvalidOperationException("db hiccup") : Task.CompletedTask; }

        await Assert.ThrowsAsync<InvalidOperationException>(() => w.Webhooks.ProcessOnceAsync("stripe", "evt_x", "t", Flaky));
        Assert.True(await w.Webhooks.ProcessOnceAsync("stripe", "evt_x", "t", Flaky));    // Stripe's retry
        Assert.Equal(2, attempts);
        w.Db.ChangeTracker.Clear();
        Assert.Single(w.Db.UgcWebhookEvents.ToList());
    }

    // ── The whole story ──────────────────────────────────────────────

    [Fact]
    public async Task Campaign_to_paid_end_to_end()
    {
        using var w = new World();

        // Brand drafts and publishes; the matching creator is told.
        var created = await w.CampaignService.CreateAsync(w.BrandUser.Id, Campaign());
        Assert.True(created.IsSuccess, created.Error?.Message);
        var published = await w.CampaignService.PublishAsync(w.BrandUser.Id, created.Value!.Id);
        Assert.True(published.IsSuccess, published.Error?.Message);
        Assert.Equal("Published", published.Value!.Status);
        Assert.Contains(w.Notifications.Sent, n => n.User == w.CreatorUser.Id && n.Type == NotificationType.UgcCampaignMatch);

        // Creator sees it and bids inside the range with a real pitch.
        var visible = await w.CampaignService.ListForCreatorAsync(w.CreatorUser.Id, onlyMatching: true);
        Assert.Single(visible.Value!);
        var tooLow = await w.ApplicationService.ApplyAsync(w.CreatorUser.Id, created.Value.Id, new(50_000, "Jag gör lunchvideor varje vecka för lokala krogar."));
        Assert.False(tooLow.IsSuccess);
        var applied = await w.ApplicationService.ApplyAsync(w.CreatorUser.Id, created.Value.Id, new(150_000, "Jag gör lunchvideor varje vecka för lokala krogar."));
        Assert.True(applied.IsSuccess, applied.Error?.Message);
        Assert.Contains(w.Notifications.Sent, n => n.User == w.BrandUser.Id && n.Type == NotificationType.UgcNewApplication);

        // Brand ranks and hires — a collab with a contract appears, the campaign closes (1 slot).
        var bids = await w.ApplicationService.ListForCampaignAsync(w.BrandUser.Id, created.Value.Id);
        Assert.Single(bids.Value!);
        var hired = await w.ApplicationService.HireAsync(w.BrandUser.Id, applied.Value!.Id);
        Assert.True(hired.IsSuccess, hired.Error?.Message);
        var collabId = hired.Value!.Id;
        Assert.Equal("Invited", hired.Value.Status);
        Assert.Equal(150_000, hired.Value.AgreedAmountOre);
        Assert.Equal(22_500, hired.Value.PlatformFeeOre);
        Assert.Equal(172_500, hired.Value.BrandTotalOre);
        Assert.Contains("Sushi Söder AB", hired.Value.ContractText);
        Assert.Contains("sex (6) månader", hired.Value.ContractText);
        Assert.Equal(UgcContractGenerator.Hash(hired.Value.ContractText), hired.Value.ContractHash);
        Assert.Contains("accept", hired.Value.AvailableActions);
        Assert.Equal("Closed", (await w.CampaignService.GetAsync(w.BrandUser.Id, created.Value.Id)).Value!.Status);

        // Creator cannot sign before the brand has accepted and paid.
        var early = await w.CollabService.AcceptAsCreatorAsync(w.CreatorUser.Id, collabId);
        Assert.False(early.IsSuccess);

        // Brand accepts → gets a checkout URL. Money is not held yet.
        var checkout = await w.CollabService.AcceptAsBrandAsync(w.BrandUser.Id, collabId);
        Assert.True(checkout.IsSuccess, checkout.Error?.Message);
        Assert.NotNull(checkout.Value!.Url);
        Assert.False(checkout.Value.Funded);
        Assert.Equal(1, w.Gateway.Checkouts);

        // Stripe says paid — twice, because Stripe does that.
        await w.Webhooks.ProcessOnceAsync("stripe", "evt_pi_1", "payment_intent.succeeded",
            ct => w.Webhooks.MarkHeldAsync(collabId, "stripe", "pi_1", "ch_1", 172_500, "cs_1", null, ct));
        await w.Webhooks.ProcessOnceAsync("stripe", "evt_pi_1", "payment_intent.succeeded",
            ct => w.Webhooks.MarkHeldAsync(collabId, "stripe", "pi_1", "ch_1", 172_500, "cs_1", null, ct));
        var held = w.Reload(collabId);
        Assert.Equal(UgcPaymentStatus.Held, held.Payment!.Status);
        Assert.Equal(172_500, held.Payment.BrandPaidOre);
        Assert.Equal("Invited", held.Status.ToString());              // creator has not signed yet

        // Creator signs → Accepted, deadline set from now.
        var accepted = await w.CollabService.AcceptAsCreatorAsync(w.CreatorUser.Id, collabId);
        Assert.True(accepted.IsSuccess, accepted.Error?.Message);
        Assert.Equal("Accepted", accepted.Value!.Status);
        Assert.NotNull(accepted.Value.DeadlineAt);
        Assert.Contains("submit", accepted.Value.AvailableActions);

        // Creator delivers a video.
        using var video = new MemoryStream(new byte[1024]);
        var submitted = await w.CollabService.SubmitAsync(w.CreatorUser.Id, collabId, video, "lunch.mp4", "video/mp4", 1024, "Första versionen!");
        Assert.True(submitted.IsSuccess, submitted.Error?.Message);
        Assert.Equal("Submitted", submitted.Value!.Status);
        Assert.NotNull(submitted.Value.AutoApproveAt);
        Assert.Single(submitted.Value.Deliverables);
        Assert.StartsWith("https://files.test/", submitted.Value.Deliverables[0].FileUrl);
        Assert.Contains(w.Notifications.Sent, n => n.User == w.BrandUser.Id && n.Type == NotificationType.UgcDelivered);

        // Brand asks for one change (feedback required), creator re-delivers.
        var noFeedback = await w.CollabService.RequestRevisionAsync(w.BrandUser.Id, collabId, new(""));
        Assert.False(noFeedback.IsSuccess);
        var revision = await w.CollabService.RequestRevisionAsync(w.BrandUser.Id, collabId, new("Visa menyn tydligare i början."));
        Assert.True(revision.IsSuccess, revision.Error?.Message);
        Assert.Equal("RevisionRequested", revision.Value!.Status);
        Assert.Equal(1, revision.Value.RevisionCount);
        using var video2 = new MemoryStream(new byte[2048]);
        var resubmitted = await w.CollabService.SubmitAsync(w.CreatorUser.Id, collabId, video2, "lunch-v2.mp4", "video/mp4", 2048, null);
        Assert.True(resubmitted.IsSuccess, resubmitted.Error?.Message);
        Assert.Equal(2, resubmitted.Value!.Deliverables.Count);

        // Brand approves → transfer of exactly the creator's amount → Paid, licence available.
        var approved = await w.CollabService.ApproveAsync(w.BrandUser.Id, collabId);
        Assert.True(approved.IsSuccess, approved.Error?.Message);
        Assert.Equal("Paid", approved.Value!.Status);
        Assert.Equal(1, w.Gateway.Transfers);
        Assert.Equal(150_000, w.Gateway.LastTransferOre);
        Assert.True(approved.Value.LicenseAvailable);
        Assert.Contains("license", approved.Value.AvailableActions);
        Assert.Contains("rate", approved.Value.AvailableActions);

        var license = await w.CollabService.GetLicenseHtmlAsync(w.BrandUser.Id, collabId);
        Assert.True(license.IsSuccess);
        Assert.Contains("Licensbevis", license.Value!);
        Assert.Contains("sex (6) månader", license.Value);
        Assert.Contains(approved.Value.ContractHash, license.Value);

        // Rating lands on the creator's record.
        var rated = await w.CollabService.RateAsync(w.BrandUser.Id, collabId, new(5));
        Assert.True(rated.IsSuccess);
        var creatorDto = await w.CreatorService.GetMineAsync(w.CreatorUser.Id);
        Assert.Equal(1, creatorDto.Value!.DeliveredCount);
        Assert.Equal(1, creatorDto.Value.RatingCount);
        Assert.Equal(5m, creatorDto.Value.AverageRating);

        // The audit trail tells the whole story.
        var final = w.Reload(collabId);
        var path = final.Events.OrderBy(e => e.Sequence).Select(e => e.ToStatus.ToString()).ToList();
        Assert.Equal(["Invited", "Invited", "Accepted", "Submitted", "RevisionRequested", "Submitted", "Approved", "Paid"], path);
    }

    [Fact]
    public async Task Product_exchange_needs_no_checkout_and_no_transfer()
    {
        using var w = new World();
        var invite = await w.CollabService.DirectInviteAsync(w.BrandUser.Id, new DirectInviteRequest(
            w.Creator.Id, "Smakprov på nya menyn",
            new UgcBriefDto("Visa nya menyn", "9:16", 20, 1, [], "Kom förbi", [], [], [], null),
            "ProductExchange", 0, "Middag för två", 60_000, "Organic", 5));
        Assert.True(invite.IsSuccess, invite.Error?.Message);
        Assert.Contains("skattepliktig inkomst", invite.Value!.ContractText);
        Assert.Equal(0, invite.Value.BrandTotalOre);

        var brand = await w.CollabService.AcceptAsBrandAsync(w.BrandUser.Id, invite.Value.Id);
        Assert.True(brand.IsSuccess);
        Assert.True(brand.Value!.ProductExchange);
        Assert.Equal(0, w.Gateway.Checkouts);

        var creator = await w.CollabService.AcceptAsCreatorAsync(w.CreatorUser.Id, invite.Value.Id);
        Assert.Equal("Accepted", creator.Value!.Status);

        using var video = new MemoryStream(new byte[100]);
        await w.CollabService.SubmitAsync(w.CreatorUser.Id, invite.Value.Id, video, "a.mov", "video/quicktime", 100, null);
        var approved = await w.CollabService.ApproveAsync(w.BrandUser.Id, invite.Value.Id);
        Assert.Equal("Paid", approved.Value!.Status);
        Assert.Equal(0, w.Gateway.Transfers);
        Assert.Equal("NotApplicable", approved.Value.Payment!.Status);
    }

    [Fact]
    public async Task Dispute_split_pays_share_refunds_rest_keeps_fee()
    {
        using var w = new World();
        var invite = await w.CollabService.DirectInviteAsync(w.BrandUser.Id, new DirectInviteRequest(
            w.Creator.Id, "Video", new UgcBriefDto("Mål", "9:16", 20, 1, [], "CTA", [], [], [], null), "Paid", 100_000, null, null, "Organic", 5));
        var id = invite.Value!.Id;
        await w.CollabService.AcceptAsBrandAsync(w.BrandUser.Id, id);
        await w.Webhooks.MarkHeldAsync(id, "stripe", "pi_9", "ch_9", 115_000, null, null);
        await w.CollabService.AcceptAsCreatorAsync(w.CreatorUser.Id, id);
        using var video = new MemoryStream(new byte[100]);
        await w.CollabService.SubmitAsync(w.CreatorUser.Id, id, video, "a.mp4", "video/mp4", 100, null);

        var disputed = await w.CollabService.OpenDisputeAsync(w.BrandUser.Id, id, new("Videon visar fel produkt jämfört med briefen."));
        Assert.True(disputed.IsSuccess, disputed.Error?.Message);
        Assert.Equal("Disputed", disputed.Value!.Status);
        Assert.Null(disputed.Value.AutoApproveAt);
        Assert.Contains(w.Notifications.Sent, n => n.User == w.AdminUser.Id && n.Type == NotificationType.UgcDispute);

        // Neither party can approve while it is open; only the admin resolves.
        Assert.False((await w.CollabService.ApproveAsync(w.BrandUser.Id, id)).IsSuccess);
        var open = await w.AdminService.ListDisputesAsync(openOnly: true);
        Assert.Single(open.Value!);

        var resolved = await w.AdminService.ResolveDisputeAsync(w.AdminUser.Id, open.Value![0].DisputeId,
            new("Split", 40, "Leveransen följer briefen till hälften: rätt format, fel produkt i två av tre klipp."));
        Assert.True(resolved.IsSuccess, resolved.Error?.Message);

        var final = w.Reload(id);
        Assert.Equal(UgcCollabStatus.Paid, final.Status);
        Assert.Equal(40_000, w.Gateway.LastTransferOre);           // 40 % of the agreed 1 000 kr
        Assert.Equal(60_000, w.Gateway.LastRefundOre);             // the rest back — fee (150 kr) stays
        Assert.Equal(UgcPaymentStatus.PartiallyRefunded, final.Payment!.Status);
        Assert.Equal(40_000, final.Payment.TransferredOre);
        Assert.Equal(60_000, final.Payment.RefundedOre);
        Assert.Equal(UgcDisputeStatus.Resolved, final.Dispute!.Status);
        Assert.Equal(UgcDisputeDecision.Split, final.Dispute.Decision);
    }

    [Fact]
    public async Task Admin_can_record_money_received_outside_the_gateway()
    {
        using var w = new World();
        var invite = await w.CollabService.DirectInviteAsync(w.BrandUser.Id, new DirectInviteRequest(
            w.Creator.Id, "Video", new UgcBriefDto("Mål", "9:16", 20, 1, [], "CTA", [], [], [], null), "Paid", 100_000, null, null, "Organic", 5));
        var id = invite.Value!.Id;

        var tooEarly = await w.AdminService.MarkFundedManuallyAsync(w.AdminUser.Id, id, "bankgiro");
        Assert.False(tooEarly.IsSuccess);                           // brand must accept the contract first

        await w.CollabService.AcceptAsBrandAsync(w.BrandUser.Id, id);
        var funded = await w.AdminService.MarkFundedManuallyAsync(w.AdminUser.Id, id, "bankgiro 2026-09-08");
        Assert.True(funded.IsSuccess, funded.Error?.Message);
        Assert.Equal("Held", funded.Value!.Payment!.Status);
        Assert.Equal(115_000, funded.Value.Payment.BrandPaidOre);

        var again = await w.AdminService.MarkFundedManuallyAsync(w.AdminUser.Id, id, "dubbelt");
        Assert.False(again.IsSuccess);
    }

    [Fact]
    public async Task Unverified_creator_cannot_bid_on_paid_work()
    {
        using var w = new World();
        w.UgcCreator.Status = UgcCreatorStatus.Pending; w.Db.SaveChanges();
        var c = await w.CampaignService.CreateAsync(w.BrandUser.Id, Campaign());
        await w.CampaignService.PublishAsync(w.BrandUser.Id, c.Value!.Id);
        var r = await w.ApplicationService.ApplyAsync(w.CreatorUser.Id, c.Value.Id, new(150_000, "En tillräckligt lång pitch för att passera."));
        Assert.False(r.IsSuccess);
        Assert.Contains("verifieras", r.Error!.Message);
    }

    [Fact]
    public async Task Brand_without_org_number_cannot_publish()
    {
        using var w = new World();
        w.Brand.OrganizationNumber = null; w.Db.SaveChanges();
        var c = await w.CampaignService.CreateAsync(w.BrandUser.Id, Campaign());
        var p = await w.CampaignService.PublishAsync(w.BrandUser.Id, c.Value!.Id);
        Assert.False(p.IsSuccess);
        Assert.Contains("organisationsnummer", p.Error!.Message);
    }
}
