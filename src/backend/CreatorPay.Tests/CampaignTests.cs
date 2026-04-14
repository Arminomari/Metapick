using System.Net;
using System.Net.Http.Json;
using CreatorPay.Tests.Infrastructure;

namespace CreatorPay.Tests;

[Collection("Integration")]
public class CampaignTests(CreatorPayFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task CreateCampaign_AsBrand_ReturnsOk()
    {
        await _client.RegisterAndLogin($"brand-camp-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");

        // Create brand profile first
        await _client.PostAsJsonAsync("/api/creators/brand-profile", new
        {
            companyName = "TestCo",
            orgNumber = "556677-8899",
            industry = "Tech",
            country = "SE"
        });

        var res = await _client.PostAsJsonAsync("/api/campaigns", new
        {
            name = "Test Campaign",
            description = "Integration test campaign",
            country = "SE",
            category = "Tech",
            requiredHashtag = "#testcampaign",
            payoutModel = "Fixed",
            budget = 10000,
            maxCreators = 5,
            requiredVideoCount = 2,
            minViews = 1000,
            startDate = DateTime.UtcNow.ToString("o"),
            endDate = DateTime.UtcNow.AddDays(30).ToString("o"),
            reviewMode = "ManualReview",
            requirements = Array.Empty<object>(),
            rules = Array.Empty<object>(),
            payoutRules = new[] { new { payoutType = "FixedThreshold", minViews = 1000, amount = 500, sortOrder = 0 } }
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("Test Campaign", body);
    }

    [Fact]
    public async Task CreateCampaign_AsCreator_Returns403()
    {
        await _client.RegisterAndLogin($"creator-camp-{Guid.NewGuid():N}@test.se", "Test1234!", "Creator");

        var res = await _client.PostAsJsonAsync("/api/campaigns", new
        {
            name = "Unauthorized", description = "Nope", country = "SE", category = "Tech",
            requiredHashtag = "#no", payoutModel = "Fixed", budget = 1000, maxCreators = 1,
            requiredVideoCount = 1, minViews = 100,
            startDate = DateTime.UtcNow.ToString("o"), endDate = DateTime.UtcNow.AddDays(7).ToString("o"),
            reviewMode = "ManualReview", requirements = Array.Empty<object>(),
            rules = Array.Empty<object>(), payoutRules = Array.Empty<object>()
        });

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task BrowseCampaigns_AsCreator_ReturnsOk()
    {
        await _client.RegisterAndLogin($"creator-browse-{Guid.NewGuid():N}@test.se", "Test1234!", "Creator");

        var res = await _client.GetAsync("/api/campaigns/browse");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task GetCampaign_NonExistent_Returns404()
    {
        await _client.LoginAs("admin@metapick.se", "Admin123!");

        var res = await _client.GetAsync($"/api/campaigns/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }
}
