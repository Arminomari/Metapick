using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

public class CampaignService : ICampaignService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<Campaign> _campaigns;
    private readonly IRepository<BrandProfile> _brands;
    private readonly IAuditService _audit;
    private readonly INotificationService _notifications;

    public CampaignService(
        IUnitOfWork uow,
        IRepository<Campaign> campaigns,
        IRepository<BrandProfile> brands,
        IAuditService audit,
        INotificationService notifications)
    {
        _uow = uow;
        _campaigns = campaigns;
        _brands = brands;
        _audit = audit;
        _notifications = notifications;
    }

    public async Task<Result<CampaignDetailDto>> CreateCampaignAsync(Guid brandUserId, CreateCampaignRequest request, CancellationToken ct = default)
    {
        var brand = await _brands.Query()
            .FirstOrDefaultAsync(b => b.UserId == brandUserId && b.Status == BrandStatus.Approved, ct);

        if (brand == null)
            return Errors.Forbidden("Brand account must be approved before creating campaigns");

        if (!Enum.TryParse<PayoutModel>(request.PayoutModel, out var payoutModel))
            return Errors.Validation("Invalid payout model");

        if (request.EndDate.Date <= DateTime.UtcNow.Date)
            return Errors.Validation("End date must be in the future");
        if (request.StartDate.Date > request.EndDate.Date)
            return Errors.Validation("Start date cannot be after end date");

        var campaign = new Campaign
        {
            BrandProfileId = brand.Id,
            Name = request.Name,
            Description = request.Description,
            TargetAudience = request.TargetAudience,
            Country = request.Country,
            Region = request.Region,
            Category = request.Category,
            RequiredHashtag = request.RequiredHashtag,
            ContentInstructions = request.ContentInstructions,
            ForbiddenContent = request.ForbiddenContent,
            MinViews = request.MinViews,
            MaxViews = request.MaxViews,
            PayoutModel = payoutModel,
            Budget = request.Budget,
            MaxCreators = request.MaxCreators,
            RequiredVideoCount = request.RequiredVideoCount > 0 ? request.RequiredVideoCount : 1,
            StartDate = DateTime.SpecifyKind(request.StartDate, DateTimeKind.Utc),
            EndDate = DateTime.SpecifyKind(request.EndDate, DateTimeKind.Utc),
            ReviewMode = Enum.TryParse<ReviewMode>(request.ReviewMode, out var rm) ? rm : ReviewMode.ManualReview,
            Status = CampaignStatus.Draft,
            Perks = request.Perks,
            ContentTags = request.ContentTags?.ToArray() ?? []
        };

        // Add requirements
        foreach (var req in request.Requirements ?? [])
        {
            if (Enum.TryParse<RequirementType>(req.RequirementType, out var rt))
            {
                campaign.Requirements.Add(new CampaignRequirement
                {
                    RequirementType = rt,
                    Value = req.Value,
                    IsRequired = req.IsRequired
                });
            }
        }

        // Add rules
        foreach (var rule in request.Rules ?? [])
        {
            if (Enum.TryParse<RuleType>(rule.RuleType, out var ruleType))
            {
                campaign.Rules.Add(new CampaignRule
                {
                    RuleType = ruleType,
                    Description = rule.Description,
                    IsMandatory = rule.IsMandatory
                });
            }
        }

        // Add payout rules
        foreach (var pr in request.PayoutRules ?? [])
        {
            if (Enum.TryParse<PayoutType>(pr.PayoutType, out var pt))
            {
                campaign.PayoutRules.Add(new PayoutRule
                {
                    PayoutType = pt,
                    MinViews = pr.MinViews,
                    MaxViews = pr.MaxViews,
                    Amount = pr.Amount,
                    MaxPayoutPerCreator = pr.MaxPayoutPerCreator,
                    SortOrder = pr.SortOrder
                });
            }
        }

        _campaigns.Add(campaign);
        await _uow.SaveChangesAsync(ct);

        await _audit.LogAsync(brandUserId, "Campaign.Created", "Campaign", campaign.Id);

        // New campaign — no assignments yet
        return MapToDetail(campaign, 0, 0);
    }

    public async Task<Result<CampaignDetailDto>> PublishCampaignAsync(Guid campaignId, Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var campaign = await _campaigns.Query()
            .Include(c => c.PayoutRules)
            .Include(c => c.Requirements)
            .Include(c => c.Rules)
            .Include(c => c.Assignments)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.BrandProfileId == brand.Id, ct);

        if (campaign == null) return Errors.NotFound("Campaign", campaignId);
        if (campaign.Status != CampaignStatus.Draft)
            return Errors.Conflict("Campaign can only be submitted from Draft status");
        if (!campaign.PayoutRules.Any())
            return Errors.Validation("Campaign must have at least one payout rule");

        campaign.Status = CampaignStatus.PendingReview;
        campaign.ModerationStatus = ModerationStatus.Pending;

        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(brandUserId, "Campaign.SubmittedForReview", "Campaign", campaign.Id);

        var approvedCount = campaign.Assignments.Count(a => a.Status == AssignmentStatus.Active);
        var totalViews = campaign.Assignments.Sum(a => a.TotalVerifiedViews);
        return MapToDetail(campaign, approvedCount, totalViews);
    }

    public async Task<Result<PagedResult<AdminCampaignDto>>> ListPendingReviewCampaignsAsync(int page, int pageSize, CancellationToken ct = default)
    {
        var query = _campaigns.Query()
            .Include(c => c.BrandProfile)
            .Where(c => c.Status == CampaignStatus.PendingReview && !c.IsDeleted);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new AdminCampaignDto(
                c.Id, c.Name, c.BrandProfile.CompanyName, c.Category, c.Country,
                c.Status.ToString(), c.Budget, c.MaxCreators, c.StartDate, c.EndDate,
                c.CreatedAt, null))
            .ToListAsync(ct);

        return new PagedResult<AdminCampaignDto>
        {
            Data = items, Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<CampaignDetailDto>> ApproveCampaignAsync(Guid campaignId, Guid adminId, CancellationToken ct = default)
    {
        var campaign = await _campaigns.Query()
            .Include(c => c.PayoutRules)
            .Include(c => c.Requirements)
            .Include(c => c.Rules)
            .Include(c => c.Assignments)
            .FirstOrDefaultAsync(c => c.Id == campaignId && !c.IsDeleted, ct);

        if (campaign == null) return Errors.NotFound("Campaign", campaignId);
        if (campaign.Status != CampaignStatus.PendingReview)
            return Errors.Conflict("Campaign is not pending review");

        campaign.Status = CampaignStatus.Active;
        campaign.PublishedAt = DateTime.UtcNow;
        campaign.ModerationStatus = ModerationStatus.Approved;

        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(adminId, "Campaign.Approved", "Campaign", campaign.Id);

        var approvedCount = campaign.Assignments.Count(a => a.Status == AssignmentStatus.Active);
        var totalViews = campaign.Assignments.Sum(a => a.TotalVerifiedViews);
        return MapToDetail(campaign, approvedCount, totalViews);
    }

    public async Task<Result<CampaignDetailDto>> RejectCampaignAsync(Guid campaignId, Guid adminId, string reason, CancellationToken ct = default)
    {
        var campaign = await _campaigns.Query()
            .Include(c => c.PayoutRules)
            .Include(c => c.Requirements)
            .Include(c => c.Rules)
            .Include(c => c.Assignments)
            .FirstOrDefaultAsync(c => c.Id == campaignId && !c.IsDeleted, ct);

        if (campaign == null) return Errors.NotFound("Campaign", campaignId);
        if (campaign.Status != CampaignStatus.PendingReview)
            return Errors.Conflict("Campaign is not pending review");

        campaign.Status = CampaignStatus.Draft;
        campaign.ModerationStatus = ModerationStatus.Rejected;

        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(adminId, "Campaign.Rejected", "Campaign", campaign.Id);

        var approvedCount = campaign.Assignments.Count(a => a.Status == AssignmentStatus.Active);
        var totalViews = campaign.Assignments.Sum(a => a.TotalVerifiedViews);
        return MapToDetail(campaign, approvedCount, totalViews);
    }

    public async Task<Result<CampaignDetailDto>> PauseCampaignAsync(Guid campaignId, Guid userId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var campaign = await _campaigns.Query()
            .Include(c => c.Assignments)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.BrandProfileId == brand.Id, ct);
        if (campaign == null) return Errors.NotFound("Campaign", campaignId);
        if (campaign.Status != CampaignStatus.Active)
            return Errors.Conflict("Can only pause active campaigns");

        campaign.Status = CampaignStatus.Paused;
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(userId, "Campaign.Paused", "Campaign", campaign.Id);
        var approvedCount = campaign.Assignments.Count(a => a.Status == AssignmentStatus.Active);
        var totalViews = campaign.Assignments.Sum(a => a.TotalVerifiedViews);
        return MapToDetail(campaign, approvedCount, totalViews);
    }

    public async Task<Result<CampaignDetailDto>> ResumeCampaignAsync(Guid campaignId, Guid userId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == userId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var campaign = await _campaigns.Query()
            .Include(c => c.Assignments)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.BrandProfileId == brand.Id, ct);
        if (campaign == null) return Errors.NotFound("Campaign", campaignId);
        if (campaign.Status != CampaignStatus.Paused)
            return Errors.Conflict("Can only resume paused campaigns");

        campaign.Status = CampaignStatus.Active;
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(userId, "Campaign.Resumed", "Campaign", campaign.Id);
        var approvedCount = campaign.Assignments.Count(a => a.Status == AssignmentStatus.Active);
        var totalViews = campaign.Assignments.Sum(a => a.TotalVerifiedViews);
        return MapToDetail(campaign, approvedCount, totalViews);
    }

    public async Task<Result<CampaignDetailDto>> GetCampaignAsync(Guid campaignId, CancellationToken ct = default)
    {
        var campaign = await _campaigns.Query()
            .Include(c => c.Requirements)
            .Include(c => c.Rules)
            .Include(c => c.PayoutRules)
            .Include(c => c.Assignments)
            .FirstOrDefaultAsync(c => c.Id == campaignId && !c.IsDeleted, ct);

        if (campaign == null) return Errors.NotFound("Campaign", campaignId);

        var approvedCount = campaign.Assignments.Count(a => a.Status == AssignmentStatus.Active);
        var totalViews = campaign.Assignments.Sum(a => a.TotalVerifiedViews);

        return MapToDetail(campaign, approvedCount, totalViews);
    }

    public async Task<Result<CampaignDetailDto>> UpdateCampaignAsync(Guid campaignId, Guid brandUserId, UpdateCampaignRequest request, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var campaign = await _campaigns.Query()
            .Include(c => c.Assignments)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.BrandProfileId == brand.Id, ct);
        if (campaign == null) return Errors.NotFound("Campaign", campaignId);
        if (campaign.Status != CampaignStatus.Draft)
            return Errors.Conflict("Can only edit draft campaigns");

        if (request.Name != null) campaign.Name = request.Name;
        if (request.Description != null) campaign.Description = request.Description;
        if (request.Budget.HasValue) campaign.Budget = request.Budget.Value;
        if (request.StartDate.HasValue) campaign.StartDate = request.StartDate.Value;
        if (request.EndDate.HasValue) campaign.EndDate = request.EndDate.Value;

        if (campaign.EndDate.Date <= DateTime.UtcNow.Date)
            return Errors.Validation("End date must be in the future");

        await _uow.SaveChangesAsync(ct);
        var approvedCount = campaign.Assignments.Count(a => a.Status == AssignmentStatus.Active);
        var totalViews = campaign.Assignments.Sum(a => a.TotalVerifiedViews);
        return MapToDetail(campaign, approvedCount, totalViews);
    }

    public async Task<Result<PagedResult<CampaignListDto>>> ListBrandCampaignsAsync(
        Guid brandUserId, string? status, int page, int pageSize, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var query = _campaigns.Query()
            .Where(c => c.BrandProfileId == brand.Id && !c.IsDeleted);

        if (Enum.TryParse<CampaignStatus>(status, out var s))
            query = query.Where(c => c.Status == s);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Include(c => c.Assignments)
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CampaignListDto(
                c.Id, c.Name, c.Category, c.Country, c.Status.ToString(),
                c.Budget, c.BudgetSpent, c.MaxCreators,
                c.Assignments.Count(a => a.Status == AssignmentStatus.Active),
                c.StartDate, c.EndDate, c.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<CampaignListDto>
        {
            Data = items, Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<PagedResult<CampaignBrowseDto>>> BrowseCampaignsAsync(
        string? category, string? country, int page, int pageSize, CancellationToken ct = default)
    {
        var todayStart = DateTime.UtcNow.Date;
        var query = _campaigns.Query()
            .Where(c => c.Status == CampaignStatus.Active && !c.IsDeleted && c.EndDate >= todayStart);

        if (!string.IsNullOrEmpty(category))
            query = query.Where(c => c.Category == category);
        if (!string.IsNullOrEmpty(country))
            query = query.Where(c => c.Country == country);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Include(c => c.BrandProfile)
            .Include(c => c.Requirements)
            .Include(c => c.PayoutRules)
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                Campaign = c,
                BrandName = c.BrandProfile.CompanyName,
                ActiveSlots = c.MaxCreators - c.Assignments.Count(a => a.Status == AssignmentStatus.Active),
                Requirements = c.Requirements.Select(r => new CampaignRequirementDto(r.RequirementType.ToString(), r.Value, r.IsRequired)).ToList(),
                PayoutRules = c.PayoutRules.ToList()
            })
            .ToListAsync(ct);

        var dtos = items.Select(x => new CampaignBrowseDto(
            x.Campaign.Id, x.Campaign.Name, x.BrandName, x.Campaign.Category, x.Campaign.Country,
            x.Campaign.Description, x.Campaign.MinViews, x.Campaign.PayoutModel.ToString(),
            BuildPayoutSummary(x.PayoutRules),
            x.Campaign.MaxCreators,
            x.ActiveSlots,
            x.Campaign.StartDate, x.Campaign.EndDate,
            x.Requirements,
            x.Campaign.CoverImageUrl,
            x.Campaign.Perks, x.Campaign.ContentTags?.ToList() ?? []
        )).ToList();

        return new PagedResult<CampaignBrowseDto>
        {
            Data = dtos, Page = page, PageSize = pageSize, TotalCount = totalCount
        };
    }

    public async Task<Result<CursorPagedResult<CampaignBrowseDto>>> BrowseCampaignsWithCursorAsync(
        string? category, string? country, string? cursor, int pageSize, CancellationToken ct = default)
    {
        // Decode cursor → (CreatedAt, Id)
        DateTime? cursorDate = null;
        Guid? cursorId = null;
        if (!string.IsNullOrEmpty(cursor))
        {
            try
            {
                var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
                var parts = decoded.Split('|');
                if (parts.Length == 2 && long.TryParse(parts[0], out var ticks) && Guid.TryParse(parts[1], out var id))
                {
                    cursorDate = new DateTime(ticks, DateTimeKind.Utc);
                    cursorId = id;
                }
            }
            catch
            {
                return Errors.Validation("Invalid pagination cursor");
            }
        }

        var todayStart = DateTime.UtcNow.Date;
        var query = _campaigns.Query()
            .Where(c => c.Status == CampaignStatus.Active && !c.IsDeleted && c.EndDate >= todayStart);

        if (!string.IsNullOrEmpty(category))
            query = query.Where(c => c.Category == category);
        if (!string.IsNullOrEmpty(country))
            query = query.Where(c => c.Country == country);

        // Keyset filter: fetch items strictly before the cursor position
        if (cursorDate.HasValue && cursorId.HasValue)
        {
            var cd = cursorDate.Value;
            var ci = cursorId.Value;
            query = query.Where(c =>
                c.CreatedAt < cd ||
                (c.CreatedAt == cd && c.Id.CompareTo(ci) < 0));
        }

        // Fetch pageSize + 1 to determine HasMore
        var items = await query
            .Include(c => c.BrandProfile)
            .Include(c => c.Requirements)
            .Include(c => c.Assignments)
            .Include(c => c.PayoutRules)
            .OrderByDescending(c => c.CreatedAt)
            .ThenByDescending(c => c.Id)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore = items.Count > pageSize;
        if (hasMore) items = items.Take(pageSize).ToList();

        // Build next cursor from last item
        string? nextCursor = null;
        if (hasMore && items.Count > 0)
        {
            var last = items[^1];
            var raw = $"{last.CreatedAt.Ticks}|{last.Id}";
            nextCursor = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(raw));
        }

        var dtos = items.Select(c => new CampaignBrowseDto(
            c.Id, c.Name, c.BrandProfile.CompanyName, c.Category, c.Country,
            c.Description, c.MinViews, c.PayoutModel.ToString(),
            BuildPayoutSummary(c.PayoutRules.ToList()),
            c.MaxCreators,
            c.MaxCreators - c.Assignments.Count(a => a.Status == AssignmentStatus.Active),
            c.StartDate, c.EndDate,
            c.Requirements.Select(r => new CampaignRequirementDto(r.RequirementType.ToString(), r.Value, r.IsRequired)).ToList(),
            c.CoverImageUrl,
            c.Perks, c.ContentTags?.ToList() ?? []
        )).ToList();

        return new CursorPagedResult<CampaignBrowseDto>
        {
            Data = dtos, NextCursor = nextCursor, HasMore = hasMore, PageSize = pageSize
        };
    }

    public async Task<Result<CampaignAnalyticsDto>> GetCampaignAnalyticsAsync(Guid campaignId, Guid brandUserId, CancellationToken ct = default)
    {
        var brand = await _brands.Query().FirstOrDefaultAsync(b => b.UserId == brandUserId, ct);
        if (brand == null) return Errors.NotFound("Brand");

        var campaign = await _campaigns.Query()
            .Include(c => c.Assignments).ThenInclude(a => a.CreatorProfile)
            .Include(c => c.Assignments).ThenInclude(a => a.SocialPosts)
            .Include(c => c.Assignments).ThenInclude(a => a.Submissions)
            .Include(c => c.Assignments).ThenInclude(a => a.PayoutCalculations)
                .ThenInclude(pc => pc.PayoutRequest)
                    .ThenInclude(pr => pr!.Transactions)
            .FirstOrDefaultAsync(c => c.Id == campaignId && c.BrandProfileId == brand.Id, ct);

        if (campaign == null) return Errors.NotFound("Campaign", campaignId);

        var creatorPerf = campaign.Assignments
            .Where(a => a.Status == AssignmentStatus.Active || a.Status == AssignmentStatus.Completed)
            .Select(a => {
                var submissionDict = a.Submissions.ToDictionary(s => s.Id);

                var videos = a.SocialPosts
                    .Where(sp => sp.IsActive)
                    .Select(sp => new CreatorVideoDto(
                        sp.SubmissionId, sp.TikTokUrl, sp.TikTokVideoId, sp.LatestViewCount,
                        sp.VerificationStatus.ToString(),
                        sp.SubmissionId.HasValue && submissionDict.TryGetValue(sp.SubmissionId.Value, out var sub)
                            ? sub.RejectionReason
                            : null,
                        sp.DiscoveredAt))
                    .ToList();

                // Also include submissions that don't yet have a SocialPost
                var submissionOnlyVideos = a.Submissions
                    .Where(s => !a.SocialPosts.Any(sp => sp.SubmissionId == s.Id))
                    .Select(s => new CreatorVideoDto(
                        s.Id, s.TikTokVideoUrl, s.TikTokVideoId, 0,
                        s.Status.ToString(), s.RejectionReason, s.CreatedAt))
                    .ToList();

                videos.AddRange(submissionOnlyVideos);

                var latestPayout = a.PayoutCalculations
                    .Where(pc => pc.PayoutRequest != null)
                    .Select(pc => pc.PayoutRequest!)
                    .OrderByDescending(pr => pr.CreatedAt)
                    .FirstOrDefault();

                var payoutStatus = latestPayout?.Status.ToString()
                    ?? (a.CurrentPayoutAmount > 0 && a.Submissions.Any(s => s.Status == SubmissionStatus.Approved)
                        ? "ReadyForManualPayment"
                        : "AwaitingThreshold");

                var paidAt = latestPayout?.Transactions
                    .Where(t => t.Status == TransactionStatus.Completed)
                    .OrderByDescending(t => t.CompletedAt ?? t.InitiatedAt)
                    .Select(t => (DateTime?)(t.CompletedAt ?? t.InitiatedAt))
                    .FirstOrDefault();

                return new CreatorPerformanceDto(
                    a.Id, a.CreatorProfileId, a.CreatorProfile?.DisplayName ?? "Okänd creator",
                    a.TotalVerifiedViews, a.CurrentPayoutAmount, a.Status.ToString(),
                    payoutStatus, paidAt,
                    videos);
            })
            .ToList();

        return new CampaignAnalyticsDto(
            campaign.Id,
            creatorPerf.Sum(c => c.Views),
            creatorPerf.Count,
            creatorPerf.Sum(c => c.PayoutAmount),
            campaign.BudgetSpent,
            campaign.Budget - campaign.BudgetSpent - campaign.BudgetReserved,
            creatorPerf);
    }

    private static string BuildPayoutSummary(List<PayoutRule> rules)
    {
        if (!rules.Any()) return "Ej konfigurerad";
        var first = rules.OrderBy(r => r.SortOrder).First();
        return first.PayoutType switch
        {
            PayoutType.CPM => first.MaxPayoutPerCreator.HasValue
                ? $"{first.Amount} SEK per 1000 views (max {first.MaxPayoutPerCreator.Value} SEK)"
                : $"{first.Amount} SEK per 1000 views",
            PayoutType.FixedThreshold => $"{first.Amount} SEK vid {first.MinViews:N0}+ views",
            PayoutType.Tiered when rules.Count > 1 =>
                $"{rules.Min(r => r.Amount)}–{rules.Max(r => r.Amount)} SEK beroende på views",
            _ => rules.Count == 1
                ? $"{first.Amount} SEK"
                : $"{rules.Min(r => r.Amount)}–{rules.Max(r => r.Amount)} SEK"
        };
    }

    private static CampaignDetailDto MapToDetail(Campaign c, int approvedCount, long totalViews) =>
        new(c.Id, c.Name, c.Description, c.TargetAudience,
            c.Country, c.Region, c.Category, c.RequiredHashtag,
            c.ContentInstructions, c.ForbiddenContent,
            c.MinViews, c.MaxViews, c.PayoutModel.ToString(),
            c.Budget, c.BudgetSpent, c.BudgetReserved,
            c.MaxCreators, c.RequiredVideoCount, approvedCount, totalViews,
            c.StartDate, c.EndDate, c.Status.ToString(),
            c.Requirements?.Select(r => new CampaignRequirementDto(r.RequirementType.ToString(), r.Value, r.IsRequired)).ToList() ?? [],
            c.Rules?.Select(r => new CampaignRuleDto(r.RuleType.ToString(), r.Description, r.IsMandatory)).ToList() ?? [],
            c.PayoutRules?.Select(r => new PayoutRuleDto(r.PayoutType.ToString(), r.MinViews, r.MaxViews, r.Amount, r.MaxPayoutPerCreator, r.SortOrder)).ToList() ?? [],
            c.CreatedAt, c.PublishedAt,
            c.Perks, c.ContentTags?.ToList() ?? []);
}
