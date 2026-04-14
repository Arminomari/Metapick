using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
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
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == creatorUserId, ct);
        if (creator == null) return Errors.NotFound("Creator");

        var calc = await _calculations.GetByIdAsync(request.CalculationId);
        if (calc == null) return Errors.NotFound("PayoutCalculation", request.CalculationId);
        if (calc.Status != PayoutCalculationStatus.Verified && calc.Status != PayoutCalculationStatus.Locked)
            return Errors.Conflict("Calculation must be verified or locked before requesting payout");

        // Check no existing pending/approved request for same calculation
        var duplicate = await _requests.Query()
            .AnyAsync(r => r.PayoutCalculationId == calc.Id && r.Status != PayoutStatus.Rejected, ct);
        if (duplicate)
            return Errors.Conflict("A payout request already exists for this calculation");

        var payRequest = new PayoutRequest
        {
            CreatorProfileId = creator.Id,
            PayoutCalculationId = calc.Id,
            RequestedAmount = calc.CalculatedAmount,
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
            ? FraudStatus.Dismissed : FraudStatus.Resolved_Fraud;
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
    private readonly IUnitOfWork _uow;

    public NotificationService(IRepository<Notification> notifications, IUnitOfWork uow)
    {
        _notifications = notifications;
        _uow = uow;
    }

    public async Task SendAsync(Guid recipientId, NotificationType type, string message, Guid? referenceId = null)
    {
        _notifications.Add(new Notification
        {
            UserId = recipientId,
            Type = type,
            Title = type.ToString(),
            Message = message,
            ReferenceId = referenceId
        });
        await _uow.SaveChangesAsync();
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
    private readonly IUnitOfWork _uow;

    public AuditService(IRepository<AuditLog> logs, IUnitOfWork uow)
    {
        _logs = logs;
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

        return new PagedResult<AuditLogDto>
        {
            Data = items.Select(l => new AuditLogDto(
                l.Id, l.UserId, l.Action, l.EntityType, l.EntityId, l.IpAddress, l.CreatedAt)).ToList(),
            Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }
}
