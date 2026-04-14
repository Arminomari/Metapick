using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CreatorPay.Tests.Infrastructure;

namespace CreatorPay.Tests;

[Collection("Integration")]
public class ApplicationFlowTests(CreatorPayFactory factory)
{
    private readonly CreatorPayFactory _factory = factory;

    [Fact]
    public async Task FullFlow_BrandCreatesCampaign_CreatorApplies_BrandApproves()
    {
        // ── 1. Brand creates campaign ──
        var brandClient = _factory.CreateClient();
        var brandEmail = $"brand-flow-{Guid.NewGuid():N}@test.se";
        await brandClient.RegisterAndLogin(brandEmail, "Test1234!", "Brand");

        await brandClient.PostAsJsonAsync("/api/creators/brand-profile", new
        {
            companyName = "FlowTestCo", orgNumber = "111111-1111", industry = "Tech", country = "SE"
        });

        var campaignRes = await brandClient.PostAsJsonAsync("/api/campaigns", new
        {
            name = "Flow Test",
            description = "Full flow integration test",
            country = "SE",
            category = "Tech",
            requiredHashtag = "#flowtest",
            payoutModel = "Fixed",
            budget = 5000,
            maxCreators = 3,
            requiredVideoCount = 1,
            minViews = 500,
            startDate = DateTime.UtcNow.ToString("o"),
            endDate = DateTime.UtcNow.AddDays(30).ToString("o"),
            reviewMode = "ManualReview",
            requirements = Array.Empty<object>(),
            rules = Array.Empty<object>(),
            payoutRules = new[] { new { payoutType = "FixedThreshold", minViews = 500, amount = 300, sortOrder = 0 } }
        });
        Assert.Equal(HttpStatusCode.OK, campaignRes.StatusCode);

        var campaignBody = await campaignRes.Content.ReadAsStringAsync();
        using var campaignDoc = JsonDocument.Parse(campaignBody);
        var campaignId = campaignDoc.RootElement.GetProperty("data").GetProperty("id").GetString()!;

        // ── 2. Brand publishes campaign ──
        var publishRes = await brandClient.PostAsync($"/api/campaigns/{campaignId}/publish", null);
        Assert.Equal(HttpStatusCode.OK, publishRes.StatusCode);

        // ── 3. Creator creates profile and applies ──
        var creatorClient = _factory.CreateClient();
        var creatorEmail = $"creator-flow-{Guid.NewGuid():N}@test.se";
        await creatorClient.RegisterAndLogin(creatorEmail, "Test1234!", "Creator");

        await creatorClient.PostAsJsonAsync("/api/creators/profile", new
        {
            displayName = "FlowCreator",
            bio = "Test creator",
            category = "Tech",
            country = "SE",
            language = "sv"
        });

        var applyRes = await creatorClient.PostAsJsonAsync("/api/applications", new
        {
            campaignId,
            message = "Jag vill vara med!"
        });
        Assert.Equal(HttpStatusCode.OK, applyRes.StatusCode);

        var applyBody = await applyRes.Content.ReadAsStringAsync();
        using var applyDoc = JsonDocument.Parse(applyBody);
        var applicationId = applyDoc.RootElement.GetProperty("data").GetProperty("id").GetString()!;

        // ── 4. Brand approves application ──
        var approveRes = await brandClient.PostAsync($"/api/applications/{applicationId}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);

        // ── 5. Creator can see assignment ──
        var assignmentsRes = await creatorClient.GetAsync("/api/assignments/mine");
        Assert.Equal(HttpStatusCode.OK, assignmentsRes.StatusCode);
        var assignBody = await assignmentsRes.Content.ReadAsStringAsync();
        Assert.Contains("Flow Test", assignBody);
    }

    [Fact]
    public async Task Creator_CannotApplyTwice()
    {
        var brandClient = _factory.CreateClient();
        await brandClient.RegisterAndLogin($"brand-dup-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");
        await brandClient.PostAsJsonAsync("/api/creators/brand-profile", new
        {
            companyName = "DupCo", orgNumber = "222222-2222", industry = "Tech", country = "SE"
        });

        var campaign = await brandClient.PostAsJsonAsync("/api/campaigns", new
        {
            name = "Dup Test", description = "Test", country = "SE", category = "Tech",
            requiredHashtag = "#dup", payoutModel = "Fixed", budget = 5000, maxCreators = 3,
            requiredVideoCount = 1, minViews = 500,
            startDate = DateTime.UtcNow.ToString("o"), endDate = DateTime.UtcNow.AddDays(30).ToString("o"),
            reviewMode = "ManualReview", requirements = Array.Empty<object>(),
            rules = Array.Empty<object>(),
            payoutRules = new[] { new { payoutType = "FixedThreshold", minViews = 500, amount = 300, sortOrder = 0 } }
        });
        var campBody = await campaign.Content.ReadAsStringAsync();
        using var campDoc = JsonDocument.Parse(campBody);
        var campId = campDoc.RootElement.GetProperty("data").GetProperty("id").GetString()!;
        await brandClient.PostAsync($"/api/campaigns/{campId}/publish", null);

        var creatorClient = _factory.CreateClient();
        await creatorClient.RegisterAndLogin($"creator-dup-{Guid.NewGuid():N}@test.se", "Test1234!", "Creator");
        await creatorClient.PostAsJsonAsync("/api/creators/profile", new
        {
            displayName = "DupCreator", bio = "test", category = "Tech", country = "SE", language = "sv"
        });

        // First apply
        var res1 = await creatorClient.PostAsJsonAsync("/api/applications", new { campaignId = campId, message = "First" });
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);

        // Second apply should fail
        var res2 = await creatorClient.PostAsJsonAsync("/api/applications", new { campaignId = campId, message = "Again" });
        Assert.Equal(HttpStatusCode.Conflict, res2.StatusCode);
    }
}
