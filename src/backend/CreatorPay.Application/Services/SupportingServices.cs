using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace CreatorPay.Application.Services;

// ────────────────────────────────────────────────────────────────
// PayoutService – hantering av utbetalningar
// ────────────────────────────────────────────────────────────────
public class PayoutService : IPayoutService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<PayoutCalculation> _calculations;
    private readonly IRepository<PayoutRequest> _requests;
    private readonly IRepository<PayoutTransaction> _transactions;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IAuditService _audit;
    private readonly INotificationService _notifications;

    public PayoutService(
        IUnitOfWork uow,
        IRepository<PayoutCalculation> calculations,
        IRepository<PayoutRequest> requests,
        IRepository<PayoutTransaction> transactions,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<BrandProfile> brands,
        IRepository<CreatorProfile> creators,
        IAuditService audit,
        INotificationService notifications)
    {
        _uow = uow;
        _calculations = calculations;
        _requests = requests;
        _transactions = transactions;
        _assignments = assignments;
        _brands = brands;
        _creators = creators;
        _audit = audit;
        _notifications = notifications;
    }

    public async Task<Result<PayoutCalculationDto>> GetLatestCalculationAsync(Guid assignmentId, Guid userId, CancellationToken ct = default)
    {
        // Verify the requesting user owns this assignment (creator) or the campaign (brand)
        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);

        var isCreator = assignment.CreatorProfile?.UserId == userId;
        var isBrand = assignment.Campaign.BrandProfile?.UserId == userId;
        if (!isCreator && !isBrand)
            return Errors.Forbidden("You do not have access to this assignment's payout data");

        var calc = await _calculations.Query()
            .Where(c => c.AssignmentId == assignmentId)
            .OrderByDescending(c => c.CalculatedAt)
            .FirstOrDefaultAsync(ct);

        if (calc == null) return Errors.NotFound("PayoutCalculation");

        return new PayoutCalculationDto(calc.Id, calc.AssignmentId,
            calc.VerifiedViews, calc.CalculatedAmount,
            calc.Status.ToString(), calc.CalculatedAt);
    }

    public async Task<Result<PayoutRequestDto>> RequestPayoutAsync(Guid creatorUserId, RequestPayoutRequest request, CancellationToken ct = default)
    {
        var creator = await _creators.Query()
            .Include(c => c.TikTokAccount)
            .FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        // Payouts require a TikTok account connected via OAuth (proves channel
        // ownership) and a configured payout method.
        var tikTok = creator.TikTokAccount;
        if (tikTok == null || !tikTok.IsActive || tikTok.Scopes == "manual" || string.IsNullOrEmpty(tikTok.AccessTokenEncrypted))
            return Errors.Validation("Anslut ditt TikTok-konto via TikTok-inloggning innan du begär utbetalning.");
        if (string.IsNullOrWhiteSpace(creator.PayoutMethod) || string.IsNullOrWhiteSpace(creator.PayoutDetailsEncrypted))
            return Errors.Validation("Lägg till en utbetalningsmetod i din profil innan du begär utbetalning.");

        var calc = await _calculations.Query()
            .Include(c => c.Assignment)
            .FirstOrDefaultAsync(c => c.Id == request.CalculationId, ct);
        if (calc == null) return Errors.NotFound("PayoutCalculation", request.CalculationId);
        // Ownership: a creator may only request payout for their own assignment's calculation.
        if (calc.Assignment == null || calc.Assignment.CreatorProfileId != creator.Id)
            return Errors.Forbidden("Calculation does not belong to this creator");
        // The automatic pipeline only ever produces Preliminary calculations;
        // the human gate is the admin approval of the payout request itself.
        if (!calc.IsLatest)
            return Errors.Conflict("Calculation has been superseded by a newer one");
        if (calc.Status is PayoutCalculationStatus.Disputed or PayoutCalculationStatus.Overridden)
            return Errors.Conflict("Calculation is disputed or overridden and must be resolved by an admin");

        // Money is claimed per assignment, not per calculation: every recalculation
        // produces a new row, so paying the full amount each time would pay the
        // same earnings twice. Only the unclaimed remainder can be requested.
        var alreadyClaimed = await _requests.Query()
            .Where(r => r.Status != PayoutStatus.Rejected
                && r.PayoutCalculation.AssignmentId == calc.AssignmentId)
            .SumAsync(r => (decimal?)r.RequestedAmount, ct) ?? 0m;

        var available = calc.CalculatedAmount - alreadyClaimed;
        if (available <= 0)
            return Errors.Conflict("Du har redan begärt utbetalning för allt du tjänat på det här uppdraget.");

        var pending = await _requests.Query()
            .AnyAsync(r => r.PayoutCalculation.AssignmentId == calc.AssignmentId
                && (r.Status == PayoutStatus.Pending || r.Status == PayoutStatus.UnderReview
                    || r.Status == PayoutStatus.Approved || r.Status == PayoutStatus.Processing), ct);
        if (pending)
            return Errors.Conflict("Du har redan en utbetalning på gång för det här uppdraget — vänta tills den är klar.");

        var payRequest = new PayoutRequest
        {
            CreatorProfileId = creator.Id,
            PayoutCalculationId = calc.Id,
            RequestedAmount = available,
            Currency = "SEK",
            PayoutMethod = creator.PayoutMethod ?? "BankTransfer",
            PayoutDetailsEncrypted = creator.PayoutDetailsEncrypted ?? "",
            Status = PayoutStatus.Pending
        };

        _requests.Add(payRequest);
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(creatorUserId, "Payout.Requested", "PayoutRequest", payRequest.Id);

        return await LoadPayoutRequestDtoAsync(payRequest.Id, ct);
    }

    /// <summary>
    /// Everything the creator can cash out right now: the current calculation
    /// per assignment minus what has already been requested or paid.
    /// </summary>
    public async Task<Result<List<PayableDto>>> GetPayablesAsync(Guid creatorUserId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return new List<PayableDto>();

        var calcs = await _calculations.Query()
            .Include(c => c.Assignment).ThenInclude(a => a!.Campaign)
            .Where(c => c.IsLatest && c.Assignment != null && c.Assignment.CreatorProfileId == creator.Id
                && c.CalculatedAmount > 0)
            .ToListAsync(ct);
        if (calcs.Count == 0) return new List<PayableDto>();

        var assignmentIds = calcs.Select(c => c.AssignmentId).ToList();
        var requests = await _requests.Query()
            .Where(r => r.Status != PayoutStatus.Rejected
                && assignmentIds.Contains(r.PayoutCalculation.AssignmentId))
            .Select(r => new { r.PayoutCalculation.AssignmentId, r.RequestedAmount, r.Status })
            .ToListAsync(ct);

        return calcs
            .Select(c =>
            {
                var mine = requests.Where(r => r.AssignmentId == c.AssignmentId).ToList();
                var claimed = mine.Sum(r => r.RequestedAmount);
                var open = mine.Any(r => r.Status is PayoutStatus.Pending or PayoutStatus.UnderReview
                    or PayoutStatus.Approved or PayoutStatus.Processing);
                return new PayableDto(
                    c.AssignmentId, c.Id,
                    c.Assignment!.Campaign?.Name ?? "Uppdrag",
                    c.Assignment.Campaign?.Kind == CampaignKind.Tap,
                    c.CalculatedAmount, claimed, Math.Max(0, c.CalculatedAmount - claimed), open,
                    c.VerifiedViews, c.CalculatedAt);
            })
            .OrderByDescending(x => x.Available)
            .ToList();
    }

    public async Task<Result<PayoutRequestDto>> ApprovePayoutAsync(Guid payoutRequestId, Guid adminUserId, CancellationToken ct = default)
    {
        var req = await _requests.Query()
            .Include(r => r.CreatorProfile)
            .FirstOrDefaultAsync(r => r.Id == payoutRequestId, ct);
        if (req == null) return Errors.NotFound("PayoutRequest", payoutRequestId);
        if (req.Status != PayoutStatus.Pending)
            return Errors.Conflict("Can only approve pending payout requests");

        req.Status = PayoutStatus.Approved;
        req.ReviewedAt = DateTime.UtcNow;
        req.ReviewedBy = adminUserId;

        // Create transaction
        var tx = new PayoutTransaction
        {
            PayoutRequestId = req.Id,
            Amount = req.RequestedAmount,
            Currency = req.Currency,
            Provider = "Manual",
            Status = TransactionStatus.Initiated
        };
        _transactions.Add(tx);

        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(adminUserId, "Payout.Approved", "PayoutRequest", req.Id);
        await _notifications.SendAsync(req.CreatorProfile.UserId, NotificationType.PayoutReady,
            $"Din utbetalning på {req.RequestedAmount} SEK har godkänts!");

        return await LoadPayoutRequestDtoAsync(req.Id, ct);
    }

    public async Task<Result<PayoutRequestDto>> RejectPayoutAsync(Guid payoutRequestId, Guid adminUserId, string reason, CancellationToken ct = default)
    {
        var req = await _requests.Query()
            .FirstOrDefaultAsync(r => r.Id == payoutRequestId, ct);
        if (req == null) return Errors.NotFound("PayoutRequest", payoutRequestId);
        if (req.Status != PayoutStatus.Pending)
            return Errors.Conflict("Can only reject pending payout requests");

        req.Status = PayoutStatus.Rejected;
        req.ReviewedAt = DateTime.UtcNow;
        req.ReviewedBy = adminUserId;
        req.RejectionReason = reason;

        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(adminUserId, "Payout.Rejected", "PayoutRequest", req.Id);

        return await LoadPayoutRequestDtoAsync(req.Id, ct);
    }

    public async Task<Result<PayoutRequestDto>> MarkManualPayoutSentAsync(Guid assignmentId, Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.PayoutRules)
            .Include(a => a.CreatorProfile)
            .Include(a => a.Submissions)
            .Include(a => a.PayoutCalculations).ThenInclude(pc => pc.PayoutRequest)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);
        if (assignment.Campaign.BrandProfileId != brand.Id)
            return Errors.Forbidden("Du har inte behörighet att markera denna creator som betald");

        if (!assignment.Submissions.Any(s => s.Status == SubmissionStatus.Approved))
            return Errors.Conflict("Minst en video måste vara godkänd innan utbetalning kan markeras som skickad");

        if (assignment.CurrentPayoutAmount <= 0)
            return Errors.Conflict("Ingen utbetalning är redo ännu. Creatorn måste först nå kampanjens betalningsnivå.");

        var existingRequest = await PayoutRequestsQuery()
            .FirstOrDefaultAsync(r => r.PayoutCalculation.AssignmentId == assignmentId && r.Status != PayoutStatus.Rejected, ct);
        if (existingRequest != null)
            return Errors.Conflict("Den här creatorn har redan en registrerad utbetalning för uppdraget");

        var payoutRule = assignment.Campaign.PayoutRules
            .OrderBy(r => r.SortOrder)
            .FirstOrDefault();
        if (payoutRule == null)
            return Errors.Conflict("Kampanjen saknar betalningsregler");

        var now = DateTime.UtcNow;
        var calculation = new PayoutCalculation
        {
            AssignmentId = assignment.Id,
            CalculatedAmount = assignment.CurrentPayoutAmount,
            VerifiedViews = assignment.TotalVerifiedViews,
            PayoutRuleId = payoutRule.Id,
            CalculationDetails = JsonSerializer.Serialize(new
            {
                source = "manual-brand-payout",
                approvedSubmissionCount = assignment.Submissions.Count(s => s.Status == SubmissionStatus.Approved),
                assignment.TotalVerifiedViews,
                assignment.CurrentPayoutAmount
            }),
            Status = PayoutCalculationStatus.Locked,
            LockedAt = now,
            LockedBy = brandUserId,
            IsLatest = true,
            CalculatedAt = now
        };

        foreach (var previous in assignment.PayoutCalculations)
            previous.IsLatest = false;

        _calculations.Add(calculation);

        var request = new PayoutRequest
        {
            CreatorProfileId = assignment.CreatorProfileId,
            PayoutCalculation = calculation,
            RequestedAmount = assignment.CurrentPayoutAmount,
            Currency = payoutRule.Currency,
            PayoutMethod = "ManualByBrand",
            PayoutDetailsEncrypted = "manual-brand-payout",
            Status = PayoutStatus.Completed,
            ReviewedBy = brandUserId,
            ReviewedAt = now
        };

        _requests.Add(request);
        _transactions.Add(new PayoutTransaction
        {
            PayoutRequest = request,
            Amount = request.RequestedAmount,
            Currency = request.Currency,
            Provider = "Manual",
            Status = TransactionStatus.Completed,
            InitiatedAt = now,
            CompletedAt = now
        });

        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(brandUserId, "Payout.ManualSent", "PayoutRequest", request.Id);
        await _notifications.SendAsync(
            assignment.CreatorProfile.UserId,
            NotificationType.PayoutCompleted,
            $"{assignment.Campaign.Name}: {request.RequestedAmount} {request.Currency} har markerats som skickat av företaget.",
            request.Id);

        return await LoadPayoutRequestDtoAsync(request.Id, ct);
    }

    public async Task<Result<PagedResult<PayoutRequestDto>>> GetCreatorPayoutsAsync(
        Guid creatorUserId, string? status, int page, int pageSize, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var query = PayoutRequestsQuery().Where(r => r.CreatorProfileId == creator.Id);
        if (Enum.TryParse<PayoutStatus>(status, out var s))
            query = query.Where(r => r.Status == s);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<PayoutRequestDto>
        {
            Data = items.Select(MapToDto).ToList(),
            Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<PagedResult<PayoutRequestDto>>> GetAllPayoutsAsync(
        string? status, int page, int pageSize, CancellationToken ct = default)
    {
        var query = PayoutRequestsQuery();
        if (Enum.TryParse<PayoutStatus>(status, out var s))
            query = query.Where(r => r.Status == s);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<PayoutRequestDto>
        {
            Data = items.Select(MapToDto).ToList(),
            Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    private IQueryable<PayoutRequest> PayoutRequestsQuery() =>
        _requests.Query()
            .Include(r => r.CreatorProfile)
            .Include(r => r.Transactions)
            .Include(r => r.PayoutCalculation)
                .ThenInclude(pc => pc.Assignment)
                    .ThenInclude(a => a.Campaign);

    private async Task<PayoutRequestDto> LoadPayoutRequestDtoAsync(Guid payoutRequestId, CancellationToken ct = default)
    {
        var request = await PayoutRequestsQuery().FirstAsync(r => r.Id == payoutRequestId, ct);
        return MapToDto(request);
    }

    private static PayoutRequestDto MapToDto(PayoutRequest r)
    {
        var paidAt = r.Transactions
            .Where(t => t.Status == TransactionStatus.Completed)
            .OrderByDescending(t => t.CompletedAt ?? t.InitiatedAt)
            .Select(t => (DateTime?)(t.CompletedAt ?? t.InitiatedAt))
            .FirstOrDefault();

        return new PayoutRequestDto(
            r.Id,
            r.CreatorProfileId,
            r.PayoutCalculationId,
            r.PayoutCalculation.AssignmentId,
            r.PayoutCalculation.Assignment.CampaignId,
            r.PayoutCalculation.Assignment.Campaign.Name,
            r.RequestedAmount,
            r.Currency,
            r.Status.ToString(),
            r.PayoutMethod,
            r.RejectionReason,
            r.ReviewedAt,
            paidAt,
            r.CreatedAt);
    }
}

// ────────────────────────────────────────────────────────────────
// FraudService – bedrägerihanterings-service
// ────────────────────────────────────────────────────────────────
public class FraudService : IFraudService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<FraudFlag> _flags;
    private readonly IAuditService _audit;

    public FraudService(IUnitOfWork uow, IRepository<FraudFlag> flags, IAuditService audit)
    {
        _uow = uow;
        _flags = flags;
        _audit = audit;
    }

    public async Task<Result<FraudFlagDto>> CreateFraudFlagAsync(CreateFraudFlagRequest request)
    {
        if (!Enum.TryParse<FraudEntityType>(request.EntityType, out var entityType))
            return Errors.Validation("Invalid entity type");
        if (!Enum.TryParse<FraudType>(request.FlagType, out var fraudType))
            return Errors.Validation("Invalid fraud type");
        if (!Enum.TryParse<FraudSeverity>(request.Severity, out var severity))
            return Errors.Validation("Invalid severity");

        var flag = new FraudFlag
        {
            EntityType = entityType,
            EntityId = request.EntityId,
            FlagType = fraudType,
            Severity = severity,
            Description = request.Description,
            Status = FraudStatus.Open
        };

        _flags.Add(flag);
        await _uow.SaveChangesAsync();
        return MapToDto(flag);
    }

    public async Task<Result<FraudFlagDto>> ResolveFraudFlagAsync(Guid flagId, Guid adminUserId, ResolveFraudFlagRequest request)
    {
        var flag = await _flags.GetByIdAsync(flagId);
        if (flag == null) return Errors.NotFound("FraudFlag", flagId);
        if (flag.Status != FraudStatus.Open && flag.Status != FraudStatus.UnderReview)
            return Errors.Conflict("Flag already resolved");

        flag.Status = string.Equals(request.Action, "dismiss", StringComparison.OrdinalIgnoreCase)
            ? FraudStatus.Dismissed
            : string.Equals(request.Action, "legitimate", StringComparison.OrdinalIgnoreCase)
                ? FraudStatus.Resolved_Legitimate
                : FraudStatus.Resolved_Fraud;
        flag.ResolvedBy = adminUserId;
        flag.Resolution = request.Note;
        flag.ResolvedAt = DateTime.UtcNow;

        await _uow.SaveChangesAsync();
        await _audit.LogAsync(adminUserId, $"Fraud.{flag.Status}", "FraudFlag", flag.Id);
        return MapToDto(flag);
    }

    public async Task<Result<PagedResult<FraudFlagDto>>> GetFraudFlagsAsync(
        string? status, string? severity, int page, int pageSize)
    {
        IQueryable<FraudFlag> query = _flags.Query();
        if (Enum.TryParse<FraudStatus>(status, out var s))
            query = query.Where(f => f.Status == s);
        if (Enum.TryParse<FraudSeverity>(severity, out var sev))
            query = query.Where(f => f.Severity == sev);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<FraudFlagDto>
        {
            Data = items.Select(MapToDto).ToList(),
            Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    private static FraudFlagDto MapToDto(FraudFlag f) =>
        new(f.Id, f.EntityType.ToString(), f.EntityId, f.FlagType.ToString(),
            f.Severity.ToString(), f.Description,
            f.Status.ToString(), f.Resolution, f.ResolvedAt, f.CreatedAt);
}

// ────────────────────────────────────────────────────────────────
// NotificationService
// ────────────────────────────────────────────────────────────────
public class NotificationService : INotificationService
{
    private readonly IRepository<Notification> _notifications;
    private readonly IRepository<User> _users;
    private readonly IUnitOfWork _uow;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IRepository<Notification> notifications,
        IRepository<User> users,
        IUnitOfWork uow,
        IEmailService email,
        IConfiguration config,
        ILogger<NotificationService> logger)
    {
        _notifications = notifications;
        _users = users;
        _uow = uow;
        _email = email;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Events important enough to also reach the recipient's inbox.
    /// Account approval/rejection is excluded — AdminUserService already
    /// sends those emails itself.
    /// </summary>
    private static readonly HashSet<NotificationType> EmailedTypes = new()
    {
        NotificationType.ApplicationApproved,
        NotificationType.ApplicationRejected,
        NotificationType.NewApplication,
        NotificationType.SubmissionApproved,
        NotificationType.SubmissionRejected,
        NotificationType.PayoutReady,
        NotificationType.PayoutCompleted,
        NotificationType.PrOfferReceived
    };

    private static (string Text, string Path) CtaFor(NotificationType type) => type switch
    {
        NotificationType.ApplicationApproved => ("Öppna Mina kampanjer", "/creator/assignments"),
        NotificationType.ApplicationRejected => ("Hitta fler kampanjer", "/creator/browse"),
        NotificationType.NewApplication => ("Granska ansökningar", "/brand/applications"),
        NotificationType.SubmissionApproved => ("Öppna Mina kampanjer", "/creator/assignments"),
        NotificationType.SubmissionRejected => ("Öppna Mina kampanjer", "/creator/assignments"),
        NotificationType.PayoutReady => ("Öppna Intäkter", "/creator/earnings"),
        NotificationType.PayoutCompleted => ("Öppna Intäkter", "/creator/earnings"),
        NotificationType.PrOfferReceived => ("Öppna PR-hubben", "/creator/pr"),
        _ => ("Öppna VYRLE", "/")
    };

    private static string TitleFor(NotificationType type) => type switch
    {
        NotificationType.ApplicationApproved => "Ansökan godkänd 🎉",
        NotificationType.ApplicationRejected => "Ansökan nekad",
        NotificationType.CampaignStarted => "Kampanj startad",
        NotificationType.CampaignCompleted => "Kampanj avslutad",
        NotificationType.PayoutReady => "Utbetalning redo",
        NotificationType.PayoutCompleted => "Utbetalning genomförd 💸",
        NotificationType.FraudAlert => "Säkerhetsvarning",
        NotificationType.SystemMessage => "Meddelande från VYRLE",
        NotificationType.BrandApproved => "Konto godkänt 🎉",
        NotificationType.CreatorApproved => "Konto godkänt 🎉",
        NotificationType.NewApplication => "Ny ansökan",
        NotificationType.VideoVerified => "Video verifierad",
        NotificationType.SubmissionApproved => "Innehåll godkänt",
        NotificationType.SubmissionRejected => "Innehåll nekat",
        NotificationType.PrOfferReceived => "Nytt PR-erbjudande ✨",
        NotificationType.PrOfferAccepted => "PR-erbjudande accepterat",
        NotificationType.PrOfferDeclined => "PR-erbjudande avböjt",
        _ => "Notis"
    };

    public async Task SendAsync(Guid recipientId, NotificationType type, string message, Guid? referenceId = null)
    {
        _notifications.Add(new Notification
        {
            UserId = recipientId,
            Type = type,
            Title = TitleFor(type),
            Message = message,
            ReferenceId = referenceId
        });
        await _uow.SaveChangesAsync();

        // Important events also go out as a branded email. Best-effort:
        // the in-app notification above is the source of truth, so an email
        // failure must never bubble up to the calling flow.
        if (!EmailedTypes.Contains(type)) return;
        try
        {
            var recipientEmail = await _users.Query()
                .Where(u => u.Id == recipientId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync();
            if (string.IsNullOrWhiteSpace(recipientEmail)) return;

            var baseUrl = (_config["Frontend:BaseUrl"] ?? "https://www.vyrle.co").TrimEnd('/');
            var (ctaText, ctaPath) = CtaFor(type);
            await _email.SendAsync(recipientEmail, TitleFor(type),
                EmailTemplates.Branded(
                    TitleFor(type),
                    $"<p>{System.Net.WebUtility.HtmlEncode(message)}</p>",
                    ctaText, baseUrl + ctaPath));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Non-critical: notification email failed for {Type} to {UserId}", type, recipientId);
        }
    }

    public async Task<Result<PagedResult<NotificationDto>>> GetNotificationsAsync(
        Guid userId, bool? unreadOnly, int page, int pageSize)
    {
        var query = _notifications.Query().Where(n => n.UserId == userId);
        if (unreadOnly == true)
            query = query.Where(n => !n.IsRead);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<NotificationDto>
        {
            Data = items.Select(n => new NotificationDto(
                n.Id, n.Type.ToString(), n.Title, n.Message, n.IsRead, n.ReferenceId, n.CreatedAt)).ToList(),
            Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<bool>> MarkAsReadAsync(Guid notificationId, Guid userId)
    {
        var n = await _notifications.Query()
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == userId);
        if (n == null) return Errors.NotFound("Notification", notificationId);
        n.IsRead = true;
        n.ReadAt = DateTime.UtcNow;
        await _uow.SaveChangesAsync();
        return true;
    }

    public async Task<Result<bool>> MarkAllReadAsync(Guid userId)
    {
        var unread = await _notifications.Query()
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();
        foreach (var n in unread)
        {
            n.IsRead = true;
            n.ReadAt = DateTime.UtcNow;
        }
        await _uow.SaveChangesAsync();
        return true;
    }
}

// ────────────────────────────────────────────────────────────────
// AuditService
// ────────────────────────────────────────────────────────────────
public class AuditService : IAuditService
{
    private readonly IRepository<AuditLog> _logs;
    private readonly IRepository<User> _users;
    private readonly IUnitOfWork _uow;

    public AuditService(IRepository<AuditLog> logs, IRepository<User> users, IUnitOfWork uow)
    {
        _logs = logs;
        _users = users;
        _uow = uow;
    }

    public async Task LogAsync(Guid userId, string action, string? entityType, Guid? entityId)
    {
        _logs.Add(new AuditLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId
        });
        await _uow.SaveChangesAsync();
    }

    public async Task<Result<PagedResult<AuditLogDto>>> GetAuditLogsAsync(
        string? entityType, Guid? entityId, Guid? userId, int page, int pageSize)
    {
        IQueryable<AuditLog> query = _logs.Query();
        if (!string.IsNullOrEmpty(entityType))
            query = query.Where(l => l.EntityType == entityType);
        if (entityId.HasValue)
            query = query.Where(l => l.EntityId == entityId.Value);
        if (userId.HasValue)
            query = query.Where(l => l.UserId == userId.Value);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Resolve who performed each action (IgnoreQueryFilters: soft-deleted
        // accounts must still be identifiable in the audit trail).
        var actorIds = items.Where(l => l.UserId.HasValue).Select(l => l.UserId!.Value).Distinct().ToList();
        var actors = (await _users.Query().IgnoreQueryFilters()
                .Where(u => actorIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Email, u.Role })
                .ToListAsync())
            .ToDictionary(u => u.Id);

        return new PagedResult<AuditLogDto>
        {
            Data = items.Select(l =>
            {
                actors.TryGetValue(l.UserId ?? Guid.Empty, out var actor);
                return new AuditLogDto(
                    l.Id, l.UserId, l.Action, l.EntityType, l.EntityId, l.IpAddress, l.CreatedAt,
                    actor?.Email, actor?.Role.ToString());
            }).ToList(),
            Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }
}
