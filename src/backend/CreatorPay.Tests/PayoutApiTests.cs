using System.Net;
using System.Net.Http.Json;
using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Infrastructure.Data;
using CreatorPay.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CreatorPay.Tests;

[Collection("Integration")]
public class PayoutApiTests(CreatorPayFactory factory)
{
    private readonly CreatorPayFactory _factory = factory;

    private async Task<(HttpClient brand, HttpClient creator, string campaignId, string assignmentId)> SetupApprovedAssignmentAsync()
    {
        var brandClient = _factory.CreateClient();
        await brandClient.RegisterAndLogin($"brand-payout-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");
        await brandClient.PostAsJsonAsync("/api/creators/brand-profile", new
        {
            companyName = "PayoutCo", orgNumber = "444444-4444", industry = "Tech", country = "SE"
        });

        var campaignRes = await brandClient.PostAsJsonAsync("/api/campaigns", new
        {
            name = "Payout Test",
            description = "Manual payout api integration test",
            country = "SE",
            category = "Tech",
            requiredHashtag = "#payout",
            payoutModel = "Fixed",
            budget = 8000,
            maxCreators = 3,
            requiredVideoCount = 1,
            minViews = 1000,
            startDate = DateTime.UtcNow.ToString("o"),
            endDate = DateTime.UtcNow.AddDays(30).ToString("o"),
            reviewMode = "ManualReview",
            requirements = Array.Empty<object>(),
            rules = Array.Empty<object>(),
            payoutRules = new[] { new { payoutType = "FixedThreshold", minViews = 1000, amount = 500, sortOrder = 0 } }
        });
        Assert.Equal(HttpStatusCode.OK, campaignRes.StatusCode);
        var campaign = await campaignRes.GetData<CampaignDetailDto>();
        var campaignId = campaign!.Id.ToString();

        var publishRes = await brandClient.PostAsync($"/api/campaigns/{campaignId}/publish", null);
        Assert.Equal(HttpStatusCode.OK, publishRes.StatusCode);

        var creatorClient = _factory.CreateClient();
        await creatorClient.RegisterAndLogin($"creator-payout-{Guid.NewGuid():N}@test.se", "Test1234!", "Creator");
        await creatorClient.PostAsJsonAsync("/api/creators/profile", new
        {
            displayName = "PayoutCreator", bio = "test", category = "Tech", country = "SE", language = "sv"
        });

        var applyRes = await creatorClient.PostAsJsonAsync("/api/applications", new
        {
            campaignId,
            message = "Jag kan leverera snabbt"
        });
        Assert.Equal(HttpStatusCode.OK, applyRes.StatusCode);
        var application = await applyRes.GetData<ApplicationDto>();

        var approveRes = await brandClient.PostAsync($"/api/applications/{application!.Id}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);

        var assignmentsRes = await creatorClient.GetAsync("/api/assignments/mine");
        Assert.Equal(HttpStatusCode.OK, assignmentsRes.StatusCode);
        var assignments = await assignmentsRes.GetData<PagedResult<AssignmentListDto>>();
        var assignmentId = assignments!.Data.Single().Id.ToString();

        return (brandClient, creatorClient, campaignId, assignmentId);
    }

    private async Task<string> SubmitAndApproveVideoAsync(HttpClient brand, HttpClient creator, string assignmentId, string videoId)
    {
        var submitRes = await creator.PostAsJsonAsync($"/api/assignments/{assignmentId}/submit", new
        {
            tikTokVideoUrl = $"https://www.tiktok.com/@testuser/video/{videoId}",
            notes = "Payout test video"
        });
        Assert.Equal(HttpStatusCode.OK, submitRes.StatusCode);

        var submission = await submitRes.GetData<SubmissionDto>();
        var approveRes = await brand.PostAsync($"/api/assignments/submissions/{submission!.Id}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);

        return submission.Id.ToString();
    }

    private async Task SeedAssignmentPayoutAsync(string assignmentId, decimal amount = 500m, long views = 1750)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var assignment = await db.Assignments.FirstAsync(a => a.Id == Guid.Parse(assignmentId));
        assignment.TotalVerifiedViews = views;
        assignment.CurrentPayoutAmount = amount;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ManualPayout_AsBrand_ReturnsCompletedPayoutDto()
    {
        var (brand, creator, _, assignmentId) = await SetupApprovedAssignmentAsync();
        await SubmitAndApproveVideoAsync(brand, creator, assignmentId, "4444444444");
        await SeedAssignmentPayoutAsync(assignmentId);

        var payoutRes = await brand.PostAsync($"/api/payouts/assignments/{assignmentId}/manual", null);

        Assert.Equal(HttpStatusCode.OK, payoutRes.StatusCode);

        var payout = await payoutRes.GetData<PayoutRequestDto>();
        Assert.NotNull(payout);
        Assert.Equal("Completed", payout!.Status);
        Assert.Equal("ManualByBrand", payout.PayoutMethod);
        Assert.Equal(Guid.Parse(assignmentId), payout.AssignmentId);
        Assert.Equal(500m, payout.Amount);
        Assert.NotNull(payout.PaidAt);
    }

    [Fact]
    public async Task ManualPayout_WithoutApprovedSubmission_ReturnsConflict()
    {
        var (brand, creator, _, assignmentId) = await SetupApprovedAssignmentAsync();

        var submitRes = await creator.PostAsJsonAsync($"/api/assignments/{assignmentId}/submit", new
        {
            tikTokVideoUrl = "https://www.tiktok.com/@testuser/video/5555555555",
            notes = "Still pending"
        });
        Assert.Equal(HttpStatusCode.OK, submitRes.StatusCode);

        await SeedAssignmentPayoutAsync(assignmentId);

        var payoutRes = await brand.PostAsync($"/api/payouts/assignments/{assignmentId}/manual", null);

        Assert.Equal(HttpStatusCode.Conflict, payoutRes.StatusCode);
    }

    [Fact]
    public async Task CreatorPayouts_FilterCompleted_ReturnsManualPayout()
    {
        var (brand, creator, _, assignmentId) = await SetupApprovedAssignmentAsync();
        await SubmitAndApproveVideoAsync(brand, creator, assignmentId, "6666666666");
        await SeedAssignmentPayoutAsync(assignmentId, amount: 500m, views: 2200);

        var manualPayoutRes = await brand.PostAsync($"/api/payouts/assignments/{assignmentId}/manual", null);
        Assert.Equal(HttpStatusCode.OK, manualPayoutRes.StatusCode);

        var payoutsRes = await creator.GetAsync("/api/payouts/mine?status=Completed");
        Assert.Equal(HttpStatusCode.OK, payoutsRes.StatusCode);

        var payouts = await payoutsRes.GetData<PagedResult<PayoutRequestDto>>();
        Assert.NotNull(payouts);
        Assert.Single(payouts!.Data);
        Assert.Equal(Guid.Parse(assignmentId), payouts.Data[0].AssignmentId);
        Assert.Equal("Completed", payouts.Data[0].Status);
    }

    [Fact]
    public async Task CampaignAnalytics_AfterManualPayout_ShowsCompletedPayoutStatus()
    {
        var (brand, creator, campaignId, assignmentId) = await SetupApprovedAssignmentAsync();
        await SubmitAndApproveVideoAsync(brand, creator, assignmentId, "7777777777");
        await SeedAssignmentPayoutAsync(assignmentId, amount: 500m, views: 3200);

        var manualPayoutRes = await brand.PostAsync($"/api/payouts/assignments/{assignmentId}/manual", null);
        Assert.Equal(HttpStatusCode.OK, manualPayoutRes.StatusCode);

        var analyticsRes = await brand.GetAsync($"/api/campaigns/{campaignId}/analytics");
        Assert.Equal(HttpStatusCode.OK, analyticsRes.StatusCode);

        var analytics = await analyticsRes.GetData<CampaignAnalyticsDto>();
        Assert.NotNull(analytics);
        Assert.Single(analytics!.CreatorPerformance);
        Assert.Equal(Guid.Parse(assignmentId), analytics.CreatorPerformance[0].AssignmentId);
        Assert.Equal("Completed", analytics.CreatorPerformance[0].PayoutStatus);
        Assert.NotNull(analytics.CreatorPerformance[0].PaidAt);
    }
}