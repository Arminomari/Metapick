using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CreatorPay.Domain.Entities;
using CreatorPay.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using CreatorPay.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace CreatorPay.Tests;

[Collection("Integration")]
public class SubmissionReviewTests(CreatorPayFactory factory)
{
    private readonly CreatorPayFactory _factory = factory;

    private async Task<(HttpClient brand, HttpClient creator, string campaignId, string assignmentId)> SetupAssignment()
    {
        var brandClient = _factory.CreateClient();
        await brandClient.RegisterAndLogin($"brand-rev-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");
        await brandClient.PostAsJsonAsync("/api/creators/brand-profile", new
        {
            companyName = "ReviewCo", orgNumber = "333333-3333", industry = "Tech", country = "SE"
        });

        var campRes = await brandClient.PostAsJsonAsync("/api/campaigns", new
        {
            name = "Review Test", description = "Test review", country = "SE", category = "Tech",
            requiredHashtag = "#review", payoutModel = "Fixed", budget = 5000, maxCreators = 3,
            requiredVideoCount = 2, minViews = 500,
            startDate = DateTime.UtcNow.ToString("o"), endDate = DateTime.UtcNow.AddDays(30).ToString("o"),
            reviewMode = "ManualReview", requirements = Array.Empty<object>(),
            rules = Array.Empty<object>(),
            payoutRules = new[] { new { payoutType = "FixedThreshold", minViews = 500, amount = 300, sortOrder = 0 } }
        });
        var campaignId = await campRes.ReadId();
        await brandClient.PublishAndApproveCampaign(campaignId);

        var creatorClient = _factory.CreateClient();
        await creatorClient.RegisterAndLogin($"creator-rev-{Guid.NewGuid():N}@test.se", "Test1234!", "Creator");
        await creatorClient.PostAsJsonAsync("/api/creators/profile", new
        {
            displayName = "ReviewCreator", bio = "test", category = "Tech", country = "SE", language = "sv"
        });

        // Apply and approve
        var applyRes = await creatorClient.PostAsJsonAsync("/api/applications", new { campaignId, message = "Review me" });
        var appId = await applyRes.ReadId();
        await brandClient.PostAsync($"/api/applications/{appId}/approve", null);

        // Get assignment
        var assignRes = await creatorClient.GetAsync("/api/assignments/mine");
        var assignBody = await assignRes.Content.ReadAsStringAsync();
        using var assignDoc = JsonDocument.Parse(assignBody);
        var assignmentId = assignDoc.RootElement.GetProperty("data").GetProperty("data")
            .EnumerateArray().First().GetProperty("id").GetString()!;

        return (brandClient, creatorClient, campaignId, assignmentId);
    }

    [Fact]
    public async Task SubmitVideo_AsCreator_ReturnsOk()
    {
        var (_, creator, _, assignmentId) = await SetupAssignment();

        var res = await creator.PostAsJsonAsync($"/api/assignments/{assignmentId}/submit", new
        {
            videoUrl = TestMedia.VideoUrl(creator, 1234567890),
            notes = "Test video"
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task ApproveSubmission_AsBrand_ReturnsOk()
    {
        var (brand, creator, _, assignmentId) = await SetupAssignment();

        // Submit video
        var submitRes = await creator.PostAsJsonAsync($"/api/assignments/{assignmentId}/submit", new
        {
            videoUrl = TestMedia.VideoUrl(creator, 9876543210),
            notes = "Review this"
        });
        var submissionId = await submitRes.ReadId();

        // Brand approves
        var approveRes = await brand.PostAsync($"/api/assignments/submissions/{submissionId}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);

        var approveBody = await approveRes.Content.ReadAsStringAsync();
        Assert.Contains("Approved", approveBody);
    }

    [Fact]
    public async Task RejectSubmission_AsBrand_ReturnsOkWithReason()
    {
        var (brand, creator, _, assignmentId) = await SetupAssignment();

        var submitRes = await creator.PostAsJsonAsync($"/api/assignments/{assignmentId}/submit", new
        {
            videoUrl = TestMedia.VideoUrl(creator, 1111111111),
            notes = "Bad video"
        });
        var submissionId = await submitRes.ReadId();

        // Brand rejects with reason
        var rejectRes = await brand.PostAsJsonAsync($"/api/assignments/submissions/{submissionId}/reject", new
        {
            reason = "Videon följer inte riktlinjerna"
        });
        Assert.Equal(HttpStatusCode.OK, rejectRes.StatusCode);

        var rejectBody = await rejectRes.Content.ReadAsStringAsync();
        Assert.Contains("Rejected", rejectBody);
        Assert.Contains("riktlinjerna", rejectBody);
    }

    [Fact]
    public async Task RejectSubmission_AsWrongBrand_Returns403()
    {
        var (_, creator, _, assignmentId) = await SetupAssignment();

        var submitRes = await creator.PostAsJsonAsync($"/api/assignments/{assignmentId}/submit", new
        {
            videoUrl = TestMedia.VideoUrl(creator, 2222222222)
        });
        var submissionId = await submitRes.ReadId();

        // Different brand tries to approve
        var otherBrand = _factory.CreateClient();
        await otherBrand.RegisterAndLogin($"brand-other-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");

        var res = await otherBrand.PostAsync($"/api/assignments/submissions/{submissionId}/approve", null);
        Assert.True(res.StatusCode == HttpStatusCode.Forbidden || res.StatusCode == HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task MarkManualPayout_AsBrand_CreatesCompletedPayoutVisibleToCreator()
    {
        var (brand, creator, _, assignmentId) = await SetupAssignment();

        var submitRes = await creator.PostAsJsonAsync($"/api/assignments/{assignmentId}/submit", new
        {
            videoUrl = TestMedia.VideoUrl(creator, 3333333333),
            notes = "Ready for payment"
        });
        var submissionId = await submitRes.ReadId();

        var approveRes = await brand.PostAsync($"/api/assignments/submissions/{submissionId}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var assignment = await db.Assignments.FirstAsync(a => a.Id == Guid.Parse(assignmentId));
            assignment.TotalVerifiedViews = 2500;
            assignment.CurrentPayoutAmount = 300;
            await db.SaveChangesAsync();
        }

        var payoutRes = await brand.PostAsync($"/api/payouts/assignments/{assignmentId}/manual", null);
        Assert.Equal(HttpStatusCode.OK, payoutRes.StatusCode);

        var creatorPayouts = await creator.GetAsync("/api/payouts/mine");
        Assert.Equal(HttpStatusCode.OK, creatorPayouts.StatusCode);

        var payoutsBody = await creatorPayouts.Content.ReadAsStringAsync();
        Assert.Contains("Completed", payoutsBody);
        Assert.Contains("Review Test", payoutsBody);
        Assert.Contains("300", payoutsBody);
    }
}
