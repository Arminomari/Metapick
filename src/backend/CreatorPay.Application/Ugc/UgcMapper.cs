using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Ugc;

namespace CreatorPay.Application.Ugc;

/// <summary>Entity → DTO, in one place so every endpoint speaks the same shape.</summary>
public static class UgcMapper
{
    public static UgcBriefDto Brief(UgcCampaign c) => new(
        c.Goal, c.Format, c.LengthSeconds, c.VideoCount, c.Hooks, c.CallToAction, c.ReferenceUrls, c.Dos, c.Donts, c.ExtraNotes);

    public static void ApplyBrief(UgcCampaign c, UgcBriefDto b)
    {
        c.Goal = b.Goal.Trim();
        c.Format = b.Format.Trim();
        c.LengthSeconds = b.LengthSeconds;
        c.VideoCount = b.VideoCount;
        c.Hooks = Clean(b.Hooks);
        c.CallToAction = b.CallToAction.Trim();
        c.ReferenceUrls = Clean(b.ReferenceUrls);
        c.Dos = Clean(b.Dos);
        c.Donts = Clean(b.Donts);
        c.ExtraNotes = string.IsNullOrWhiteSpace(b.ExtraNotes) ? null : b.ExtraNotes.Trim();
    }

    public static string[] Clean(string[]? xs) =>
        (xs ?? []).Select(x => (x ?? "").Trim()).Where(x => x.Length > 0).Distinct().ToArray();

    public static UgcCampaignDto Campaign(UgcCampaign c, string brandName, string? brandLogo,
        int hired, int applications, int pending,
        UgcApplication? mine = null, Guid? myCollabId = null) => new(
        c.Id, c.BrandProfileId, brandName, brandLogo, c.Title, Brief(c), c.BriefGeneratedByAi,
        c.Region, c.Categories, c.MinFollowers, c.MaxFollowers,
        c.Compensation.ToString(), c.BudgetMinOre, c.BudgetMaxOre, c.ProductDescription, c.ProductValueOre,
        c.RightsPackage.ToString(), c.DeadlineDays, c.Slots,
        hired, applications, pending,
        c.Status.ToString(), c.PublishedAt, c.ClosedAt, c.CreatedAt,
        mine?.Status.ToString(), mine?.Id, mine?.BidOre, myCollabId);

    public static UgcApplicationDto Application(UgcApplication a, UgcCampaign campaign, CreatorProfile creator, UgcCreatorProfile? ugc, Guid? collabId) => new(
        a.Id, a.CampaignId, campaign.Title,
        a.CreatorProfileId, creator.DisplayName, creator.AvatarUrl, creator.Category,
        ugc?.City, ugc?.Region, Math.Max(creator.FollowerCount, ugc?.FollowerSnapshot ?? 0), ugc?.LikeFollowerRatio ?? 0,
        ugc?.DeliveredCount ?? 0, ugc?.OnTimeCount ?? 0, ugc?.AverageRating ?? 0, ugc?.RatingCount ?? 0, (ugc?.Status ?? UgcCreatorStatus.Pending).ToString(),
        a.BidOre, a.Pitch, a.Status.ToString(), a.CreatedAt, a.DecidedAt, a.DecisionNote, collabId);

    public static UgcCreatorProfileDto CreatorProfile(CreatorProfile c, UgcCreatorProfile p, UgcSettings s)
    {
        var canPaid = UgcVerificationRule.CanApply(p.Status, UgcCompensationType.Paid, p.PayoutOnboardingComplete, p.HasFTax, s.RequireFTaxForPaid);
        var canProduct = UgcVerificationRule.CanApply(p.Status, UgcCompensationType.ProductExchange, p.PayoutOnboardingComplete, p.HasFTax, s.RequireFTaxForPaid);
        string? blocker = p.Status switch
        {
            UgcCreatorStatus.Suspended => "Ditt konto på marknadsplatsen är avstängt.",
            UgcCreatorStatus.Pending => "Din profil väntar på verifiering. Koppla TikTok och ladda upp en exempelvideo så går det oftast automatiskt.",
            _ when !p.PayoutOnboardingComplete => "Slutför utbetalningsregistreringen för att kunna ta betalda uppdrag.",
            _ when s.RequireFTaxForPaid && !p.HasFTax => "Betalda uppdrag kräver F-skatt.",
            _ => null,
        };
        return new UgcCreatorProfileDto(
            c.Id, c.DisplayName, c.AvatarUrl,
            p.Status.ToString(), p.StatusNote, p.Strikes,
            p.Categories, p.City, p.Region, p.Languages, p.SampleVideoUrl,
            p.FollowerSnapshot, p.LikeFollowerRatio, p.SocialSnapshotAt,
            p.DeliveredCount, p.OnTimeCount, p.LateCount, p.AverageRating, p.RatingCount,
            !string.IsNullOrEmpty(p.StripeConnectAccountId), p.PayoutOnboardingComplete, p.HasFTax, p.VatRegistered, p.VatNumber,
            p.AllowPortfolioUse, canPaid, canProduct, blocker);
    }

    public static UgcPaymentDto? Payment(UgcPayment? p) => p == null ? null : new(
        p.Status.ToString(), p.BrandPaidOre, p.CreatorAmountOre, p.PlatformFeeOre,
        p.TransferredOre, p.RefundedOre, p.HeldAt, p.TransferredAt, p.RefundedAt, p.LastError);

    public static UgcDisputeDto? Dispute(UgcDispute? d) => d == null ? null : new(
        d.Id, d.OpenedBy.ToString(), d.Reason, d.Status.ToString(), d.Decision?.ToString(), d.CreatorSharePercent,
        d.AdminReasoning, d.CreatedAt, d.ResolvedAt);

    public static UgcCollabEventDto Event(UgcCollabEvent e) =>
        new(e.FromStatus?.ToString(), e.ToStatus.ToString(), e.Actor.ToString(), e.Note, e.CreatedAt);

    public static bool IsFunded(UgcCollab c) =>
        c.Compensation == UgcCompensationType.ProductExchange
        || c.Payment?.Status is UgcPaymentStatus.Held or UgcPaymentStatus.Transferred or UgcPaymentStatus.PartiallyRefunded;

    /// <summary>
    /// The buttons a viewer sees. Derived from the state table plus the
    /// funding/acceptance facts — the UI never re-implements this.
    /// </summary>
    public static List<string> AvailableActions(UgcCollab c, UgcActor viewer, bool funded)
    {
        var a = new List<string>();
        var s = c.Status;
        var terminal = UgcCollabStateMachine.IsTerminal(s);
        var brandAccepted = c.BrandAcceptedAt != null;
        var creatorAccepted = c.CreatorAcceptedAt != null;
        var free = c.Compensation == UgcCompensationType.ProductExchange;

        switch (viewer)
        {
            case UgcActor.Brand:
                if (s == UgcCollabStatus.Invited)
                {
                    if (!brandAccepted) a.Add("accept");
                    else if (!funded && !free) a.Add("pay");
                    if (!creatorAccepted) a.Add("cancel");
                }
                if (s == UgcCollabStatus.Submitted)
                {
                    a.Add("approve");
                    if (c.RevisionCount < c.MaxRevisions) a.Add("revision");
                    a.Add("dispute");
                }
                if (s == UgcCollabStatus.RevisionRequested) a.Add("dispute");
                if (s is UgcCollabStatus.Approved or UgcCollabStatus.Paid && c.BrandRating == null) a.Add("rate");
                if (s == UgcCollabStatus.Paid) a.Add("license");
                break;

            case UgcActor.Creator:
                if (s == UgcCollabStatus.Invited)
                {
                    if (brandAccepted && (funded || free) && !creatorAccepted) a.Add("accept");
                    a.Add("decline");
                }
                if (s == UgcCollabStatus.Accepted) { a.Add("start"); a.Add("submit"); a.Add("cancel"); }
                if (s == UgcCollabStatus.InProgress) { a.Add("submit"); a.Add("cancel"); }
                if (s == UgcCollabStatus.RevisionRequested) { a.Add("submit"); a.Add("dispute"); }
                if (s == UgcCollabStatus.Submitted) a.Add("dispute");
                if (s == UgcCollabStatus.Paid) a.Add("license");
                break;

            case UgcActor.Admin:
                if (!terminal) a.Add("cancel");
                if (s == UgcCollabStatus.Disputed) a.Add("resolve");
                if (s == UgcCollabStatus.Invited && !funded && !free) a.Add("mark-funded");
                break;
        }

        if (!terminal || s == UgcCollabStatus.Paid) a.Add("message");
        return a;
    }

    public static UgcCollabListDto CollabList(UgcCollab c, UgcActor viewer, int unread)
    {
        var funded = IsFunded(c);
        var actions = AvailableActions(c, viewer, funded);
        var needsAction = actions.Any(x => x is "accept" or "pay" or "approve" or "submit" or "resolve");
        return new UgcCollabListDto(
            c.Id, c.CampaignId, c.Title, c.Status.ToString(), c.Compensation.ToString(),
            c.AgreedAmountOre, c.PlatformFeeOre, c.BrandTotalOre,
            c.BrandProfileId, c.BrandProfile.CompanyName, c.BrandProfile.LogoUrl,
            c.CreatorProfileId, c.CreatorProfile.DisplayName, c.CreatorProfile.AvatarUrl,
            c.DeadlineAt, c.AutoApproveAt, c.RevisionCount, c.MaxRevisions,
            c.Deliverables.Count, unread, needsAction, funded, c.CreatedAt, c.UpdatedAt);
    }

    public static UgcCollabDetailDto CollabDetail(UgcCollab c, UgcActor viewer, List<UgcDeliverableDto> deliverables, int unread)
    {
        var funded = IsFunded(c);
        return new UgcCollabDetailDto(
            c.Id, c.CampaignId, c.ApplicationId, c.Title, c.BriefSnapshot, c.Status.ToString(), c.Compensation.ToString(),
            c.AgreedAmountOre, c.PlatformFeeOre, c.BrandTotalOre, c.FeePercentApplied,
            c.ProductDescription, c.ProductValueOre, c.RightsPackage.ToString(),
            c.DeadlineDays, c.DeadlineAt, c.AutoApproveAt,
            c.SubmittedAt, c.ApprovedAt, c.PaidAt, c.CancelledAt, c.CancelReason, c.NoShow,
            c.ContractText, c.ContractHash, c.ContractTemplateVersion, c.BrandAcceptedAt, c.CreatorAcceptedAt,
            c.RevisionCount, c.MaxRevisions, c.BrandRating, c.Status == UgcCollabStatus.Paid,
            c.BrandProfileId, c.BrandProfile.CompanyName, c.BrandProfile.LogoUrl, c.BrandProfile.UserId,
            c.CreatorProfileId, c.CreatorProfile.DisplayName, c.CreatorProfile.AvatarUrl, c.CreatorProfile.UserId,
            Payment(c.Payment), Dispute(c.Dispute),
            deliverables, c.Events.OrderBy(e => e.Sequence).Select(Event).ToList(),
            AvailableActions(c, viewer, funded),
            unread, c.CreatedAt, c.UpdatedAt);
    }
}
