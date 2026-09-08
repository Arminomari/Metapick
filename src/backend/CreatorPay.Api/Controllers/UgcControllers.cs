using CreatorPay.Application.Ugc;
using CreatorPay.Application.Ugc.Services;
using CreatorPay.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CreatorPay.Api.Controllers;

// ═══════════════════════════════════════════════════════════════════
// UGC-marknadsplatsen — "Beställ video"
// ═══════════════════════════════════════════════════════════════════

/// <summary>Creator side: profile, matching campaigns, bids, jobs.</summary>
[Route("api/ugc/creator")]
[Authorize(Policy = "CreatorOnly")]
public class UgcCreatorController : BaseController
{
    private readonly IUgcCreatorService _creator;
    private readonly IUgcCampaignService _campaigns;
    private readonly IUgcApplicationService _applications;
    private readonly IUgcCollabService _collabs;

    public UgcCreatorController(IUgcCreatorService creator, IUgcCampaignService campaigns, IUgcApplicationService applications, IUgcCollabService collabs)
    { _creator = creator; _campaigns = campaigns; _applications = applications; _collabs = collabs; }

    [HttpGet("profile")] public async Task<IActionResult> Profile(CancellationToken ct) => ToActionResult(await _creator.GetMineAsync(GetUserId(), ct));
    [HttpPut("profile")] public async Task<IActionResult> Upsert([FromBody] UpsertUgcCreatorProfileRequest r, CancellationToken ct) => ToActionResult(await _creator.UpsertMineAsync(GetUserId(), r, ct));
    [HttpPost("profile/refresh")] public async Task<IActionResult> Refresh(CancellationToken ct) => ToActionResult(await _creator.RefreshVerificationAsync(GetUserId(), ct));
    [HttpPost("payout/onboarding")] public async Task<IActionResult> Onboard(CancellationToken ct) => ToActionResult(await _creator.StartPayoutOnboardingAsync(GetUserId(), ct));
    [HttpGet("payout/status")] public async Task<IActionResult> PayoutStatus(CancellationToken ct) => ToActionResult(await _creator.GetPayoutStatusAsync(GetUserId(), ct));

    [HttpGet("campaigns")] public async Task<IActionResult> Campaigns([FromQuery] bool matching = false, CancellationToken ct = default) => ToActionResult(await _campaigns.ListForCreatorAsync(GetUserId(), matching, ct));
    [HttpGet("campaigns/{id:guid}")] public async Task<IActionResult> Campaign(Guid id, CancellationToken ct) => ToActionResult(await _campaigns.GetAsync(GetUserId(), id, ct));
    [HttpPost("campaigns/{id:guid}/apply")] public async Task<IActionResult> Apply(Guid id, [FromBody] ApplyToUgcCampaignRequest r, CancellationToken ct) => ToActionResult(await _applications.ApplyAsync(GetUserId(), id, r, ct));

    [HttpGet("applications")] public async Task<IActionResult> Applications(CancellationToken ct) => ToActionResult(await _applications.ListMineAsync(GetUserId(), ct));
    [HttpPost("applications/{id:guid}/withdraw")] public async Task<IActionResult> Withdraw(Guid id, CancellationToken ct) => ToActionResult(await _applications.WithdrawAsync(GetUserId(), id, ct));

    [HttpGet("collabs")] public async Task<IActionResult> Collabs([FromQuery] string? status, CancellationToken ct) => ToActionResult(await _collabs.ListMineAsync(GetUserId(), status, ct));
    [HttpGet("collabs/{id:guid}")] public async Task<IActionResult> Collab(Guid id, CancellationToken ct) => ToActionResult(await _collabs.GetAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/accept")] public async Task<IActionResult> Accept(Guid id, CancellationToken ct) => ToActionResult(await _collabs.AcceptAsCreatorAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/start")] public async Task<IActionResult> Start(Guid id, CancellationToken ct) => ToActionResult(await _collabs.StartAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/decline")] public async Task<IActionResult> Decline(Guid id, [FromBody] CancelUgcCollabRequest? r, CancellationToken ct) => ToActionResult(await _collabs.CancelAsync(GetUserId(), id, r ?? new CancelUgcCollabRequest(null), ct));
    [HttpPost("collabs/{id:guid}/dispute")] public async Task<IActionResult> Dispute(Guid id, [FromBody] OpenUgcDisputeRequest r, CancellationToken ct) => ToActionResult(await _collabs.OpenDisputeAsync(GetUserId(), id, r, ct));
    [HttpGet("collabs/{id:guid}/messages")] public async Task<IActionResult> Messages(Guid id, CancellationToken ct) => ToActionResult(await _collabs.GetMessagesAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/messages")] public async Task<IActionResult> Send(Guid id, [FromBody] SendUgcMessageRequest r, CancellationToken ct) => ToActionResult(await _collabs.SendMessageAsync(GetUserId(), id, r, ct));
    [HttpGet("action-count")] public async Task<IActionResult> ActionCount(CancellationToken ct) => ToActionResult(await _collabs.CountNeedingMyActionAsync(GetUserId(), ct));

    /// <summary>Deliver a video. Multipart: "file" (video) + optional "comment". Up to 500 MB.</summary>
    [HttpPost("collabs/{id:guid}/submit")]
    [RequestSizeLimit(524_288_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 524_288_000)]
    public async Task<IActionResult> Submit(Guid id, IFormFile? file, [FromForm] string? comment, CancellationToken ct)
    {
        if (file == null || file.Length == 0) return BadRequest(new { error = new { code = "VALIDATION_ERROR", message = "Välj en videofil." } });
        await using var stream = file.OpenReadStream();
        return ToActionResult(await _collabs.SubmitAsync(GetUserId(), id, stream, file.FileName, file.ContentType, file.Length, comment, ct));
    }
}

/// <summary>Brand side: campaigns, bids, the pipeline, review, payment.</summary>
[Route("api/ugc/brand")]
[Authorize(Policy = "BrandOnly")]
public class UgcBrandController : BaseController
{
    private readonly IUgcCampaignService _campaigns;
    private readonly IUgcApplicationService _applications;
    private readonly IUgcCollabService _collabs;

    public UgcBrandController(IUgcCampaignService campaigns, IUgcApplicationService applications, IUgcCollabService collabs)
    { _campaigns = campaigns; _applications = applications; _collabs = collabs; }

    [HttpGet("campaigns")] public async Task<IActionResult> List([FromQuery] string? status, CancellationToken ct) => ToActionResult(await _campaigns.ListMineAsync(GetUserId(), status, ct));
    [HttpPost("campaigns")] public async Task<IActionResult> Create([FromBody] UpsertUgcCampaignRequest r, CancellationToken ct) => ToActionResult(await _campaigns.CreateAsync(GetUserId(), r, ct));
    [HttpGet("campaigns/{id:guid}")] public async Task<IActionResult> Get(Guid id, CancellationToken ct) => ToActionResult(await _campaigns.GetAsync(GetUserId(), id, ct));
    [HttpPut("campaigns/{id:guid}")] public async Task<IActionResult> Update(Guid id, [FromBody] UpsertUgcCampaignRequest r, CancellationToken ct) => ToActionResult(await _campaigns.UpdateAsync(GetUserId(), id, r, ct));
    [HttpDelete("campaigns/{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct) => ToActionResult(await _campaigns.DeleteAsync(GetUserId(), id, ct));
    [HttpPost("campaigns/{id:guid}/publish")] public async Task<IActionResult> Publish(Guid id, CancellationToken ct) => ToActionResult(await _campaigns.PublishAsync(GetUserId(), id, ct));
    [HttpPost("campaigns/{id:guid}/close")] public async Task<IActionResult> Close(Guid id, CancellationToken ct) => ToActionResult(await _campaigns.CloseAsync(GetUserId(), id, ct));
    [HttpPost("campaigns/generate-brief")] public async Task<IActionResult> GenerateBrief([FromBody] GenerateUgcBriefRequest r, CancellationToken ct) => ToActionResult(await _campaigns.GenerateBriefAsync(GetUserId(), r, ct));
    [HttpGet("campaigns/{id:guid}/applications")] public async Task<IActionResult> Applications(Guid id, CancellationToken ct) => ToActionResult(await _applications.ListForCampaignAsync(GetUserId(), id, ct));

    [HttpPost("applications/{id:guid}/preselect")] public async Task<IActionResult> Preselect(Guid id, CancellationToken ct) => ToActionResult(await _applications.PreselectAsync(GetUserId(), id, ct));
    [HttpPost("applications/{id:guid}/reject")] public async Task<IActionResult> Reject(Guid id, [FromBody] DecideUgcApplicationRequest? r, CancellationToken ct) => ToActionResult(await _applications.RejectAsync(GetUserId(), id, r ?? new DecideUgcApplicationRequest(null), ct));
    [HttpPost("applications/{id:guid}/hire")] public async Task<IActionResult> Hire(Guid id, CancellationToken ct) => ToActionResult(await _applications.HireAsync(GetUserId(), id, ct));

    [HttpGet("collabs")] public async Task<IActionResult> Collabs([FromQuery] string? status, CancellationToken ct) => ToActionResult(await _collabs.ListMineAsync(GetUserId(), status, ct));
    [HttpPost("collabs/invite")] public async Task<IActionResult> Invite([FromBody] DirectInviteRequest r, CancellationToken ct) => ToActionResult(await _collabs.DirectInviteAsync(GetUserId(), r, ct));
    [HttpGet("collabs/{id:guid}")] public async Task<IActionResult> Collab(Guid id, CancellationToken ct) => ToActionResult(await _collabs.GetAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/accept")] public async Task<IActionResult> Accept(Guid id, CancellationToken ct) => ToActionResult(await _collabs.AcceptAsBrandAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/checkout")] public async Task<IActionResult> Checkout(Guid id, CancellationToken ct) => ToActionResult(await _collabs.GetCheckoutAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/approve")] public async Task<IActionResult> Approve(Guid id, CancellationToken ct) => ToActionResult(await _collabs.ApproveAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/revision")] public async Task<IActionResult> Revision(Guid id, [FromBody] RequestUgcRevisionRequest r, CancellationToken ct) => ToActionResult(await _collabs.RequestRevisionAsync(GetUserId(), id, r, ct));
    [HttpPost("collabs/{id:guid}/dispute")] public async Task<IActionResult> Dispute(Guid id, [FromBody] OpenUgcDisputeRequest r, CancellationToken ct) => ToActionResult(await _collabs.OpenDisputeAsync(GetUserId(), id, r, ct));
    [HttpPost("collabs/{id:guid}/cancel")] public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelUgcCollabRequest? r, CancellationToken ct) => ToActionResult(await _collabs.CancelAsync(GetUserId(), id, r ?? new CancelUgcCollabRequest(null), ct));
    [HttpPost("collabs/{id:guid}/rate")] public async Task<IActionResult> Rate(Guid id, [FromBody] RateUgcCollabRequest r, CancellationToken ct) => ToActionResult(await _collabs.RateAsync(GetUserId(), id, r, ct));
    [HttpGet("collabs/{id:guid}/messages")] public async Task<IActionResult> Messages(Guid id, CancellationToken ct) => ToActionResult(await _collabs.GetMessagesAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/messages")] public async Task<IActionResult> Send(Guid id, [FromBody] SendUgcMessageRequest r, CancellationToken ct) => ToActionResult(await _collabs.SendMessageAsync(GetUserId(), id, r, ct));
    [HttpGet("action-count")] public async Task<IActionResult> ActionCount(CancellationToken ct) => ToActionResult(await _collabs.CountNeedingMyActionAsync(GetUserId(), ct));
}

/// <summary>Admin: verification queue, disputes, numbers, manual funding.</summary>
[Route("api/ugc/admin")]
[Authorize(Policy = "AdminOnly")]
public class UgcAdminController : BaseController
{
    private readonly IUgcAdminService _admin;
    private readonly IUgcCollabService _collabs;

    public UgcAdminController(IUgcAdminService admin, IUgcCollabService collabs) { _admin = admin; _collabs = collabs; }

    [HttpGet("overview")] public async Task<IActionResult> Overview(CancellationToken ct) => ToActionResult(await _admin.GetOverviewAsync(ct));
    [HttpGet("creators")] public async Task<IActionResult> Creators([FromQuery] string? status, CancellationToken ct) => ToActionResult(await _admin.ListCreatorsAsync(status, ct));
    [HttpPost("creators/{creatorProfileId:guid}/status")] public async Task<IActionResult> SetStatus(Guid creatorProfileId, [FromBody] SetUgcCreatorStatusRequest r, CancellationToken ct) => ToActionResult(await _admin.SetCreatorStatusAsync(GetUserId(), creatorProfileId, r, ct));
    [HttpGet("disputes")] public async Task<IActionResult> Disputes([FromQuery] bool open = true, CancellationToken ct = default) => ToActionResult(await _admin.ListDisputesAsync(open, ct));
    [HttpPost("disputes/{id:guid}/resolve")] public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveUgcDisputeRequest r, CancellationToken ct) => ToActionResult(await _admin.ResolveDisputeAsync(GetUserId(), id, r, ct));
    [HttpGet("collabs")] public async Task<IActionResult> Collabs([FromQuery] string? status, CancellationToken ct) => ToActionResult(await _collabs.ListMineAsync(GetUserId(), status, ct));
    [HttpGet("collabs/{id:guid}")] public async Task<IActionResult> Collab(Guid id, CancellationToken ct) => ToActionResult(await _collabs.GetAsync(GetUserId(), id, ct));
    [HttpPost("collabs/{id:guid}/mark-funded")] public async Task<IActionResult> MarkFunded(Guid id, [FromBody] CancelUgcCollabRequest? r, CancellationToken ct) => ToActionResult(await _admin.MarkFundedManuallyAsync(GetUserId(), id, r?.Reason, ct));
    [HttpPost("collabs/{id:guid}/cancel")] public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelUgcCollabRequest? r, CancellationToken ct) => ToActionResult(await _collabs.CancelAsync(GetUserId(), id, r ?? new CancelUgcCollabRequest(null), ct));
}

/// <summary>Things both parties open the same way.</summary>
[Route("api/ugc/collabs")]
[Authorize]
public class UgcSharedController : BaseController
{
    private readonly IUgcCollabService _collabs;
    public UgcSharedController(IUgcCollabService collabs) => _collabs = collabs;

    /// <summary>Licence certificate as a printable HTML page (print → PDF).</summary>
    [HttpGet("{id:guid}/license")]
    public async Task<IActionResult> License(Guid id, CancellationToken ct)
    {
        var result = await _collabs.GetLicenseHtmlAsync(GetUserId(), id, ct);
        if (!result.IsSuccess) return ToActionResult(result);
        return Content(result.Value!, "text/html; charset=utf-8");
    }
}

/// <summary>Stripe calls here. Signature-verified, idempotent by event id.</summary>
[Route("api/ugc/webhooks")]
[AllowAnonymous]
[DisableRateLimiting]
public class UgcWebhookController : BaseController
{
    private readonly StripeWebhookParser _parser;
    private readonly IUgcWebhookService _webhooks;
    private readonly ILogger<UgcWebhookController> _logger;

    public UgcWebhookController(StripeWebhookParser parser, IUgcWebhookService webhooks, ILogger<UgcWebhookController> logger)
    { _parser = parser; _webhooks = webhooks; _logger = logger; }

    [HttpPost("stripe")]
    public async Task<IActionResult> Stripe(CancellationToken ct)
    {
        if (!_parser.IsConfigured) return StatusCode(503, new { error = "Stripe webhook secret not configured" });

        using var reader = new StreamReader(Request.Body);
        var json = await reader.ReadToEndAsync(ct);
        var signature = Request.Headers["Stripe-Signature"].ToString();

        StripeWebhookEvent evt;
        try { evt = await _parser.ParseAsync(json, signature, ct); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stripe webhook rejected (bad signature or payload)");
            return BadRequest(new { error = "invalid signature" });
        }

        var processed = await _webhooks.ProcessOnceAsync("stripe", evt.Id, evt.Type, async token =>
        {
            switch (evt.Type)
            {
                case "checkout.session.completed":
                case "payment_intent.succeeded":
                    if (evt.CollabId is { } collabId)
                        await _webhooks.MarkHeldAsync(collabId, "stripe", evt.PaymentIntentId, evt.ChargeId, evt.AmountOre, evt.CheckoutSessionId, null, token);
                    break;
                case "charge.refunded":
                    if (evt.PaymentIntentId != null)
                        await _webhooks.MarkRefundedAsync(evt.PaymentIntentId, evt.RefundedOre, evt.RefundId, token);
                    break;
                case "account.updated":
                    if (evt.AccountId != null)
                        await _webhooks.UpdateConnectAccountAsync(evt.AccountId, evt.DetailsSubmitted, evt.PayoutsEnabled, token);
                    break;
            }
        }, ct);

        return Ok(new { received = true, processed });
    }
}
