using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CreatorPay.Tests.Infrastructure;

namespace CreatorPay.Tests;

/// <summary>
/// The two rules the product is built on, end to end through the API:
/// a creator profile is invisible to brands until TikTok is connected via OAuth,
/// and a brand cannot take anything live until its organisation number is verified.
/// Both were unit-tested at the domain level; these prove the whole stack honours them.
/// </summary>
[Collection("Integration")]
public class VisibilityAndGatesTests(CreatorPayFactory factory)
{
    private readonly CreatorPayFactory _factory = factory;

    private static object Campaign(string name) => new
    {
        name,
        description = "Integration test campaign",
        country = "SE",
        category = "Tech",
        requiredHashtag = "#gate",
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
        payoutRules = new[] { new { payoutType = "FixedThreshold", minViews = 500, amount = 300, sortOrder = 0 } },
    };

    private static async Task<JsonElement> Data(HttpResponseMessage res)
    {
        var body = await res.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(body))
            throw new Exception($"Empty body from {res.RequestMessage?.RequestUri} ({(int)res.StatusCode} {res.StatusCode})");
        return JsonDocument.Parse(body).RootElement.GetProperty("data").Clone();
    }

    [Fact]
    public async Task Creator_profile_is_hidden_from_brands_until_tiktok_is_connected_via_oauth()
    {
        var handle = $"Vis{Guid.NewGuid():N}"[..14];
        var creatorEmail = $"vis-creator-{Guid.NewGuid():N}@test.se";
        var creator = _factory.CreateClient();
        await creator.RegisterAndLogin(creatorEmail, "Test1234!", "Creator", firstName: handle);

        // Connected (the helper links TikTok): the creator is told they are visible.
        var own = await Data(await creator.GetAsync("/api/creator/profile"));
        var creatorId = own.GetProperty("id").GetString()!;
        Assert.True(own.GetProperty("visibleToBrands").GetBoolean());
        // Null fields are omitted from the envelope, so "absent" is the happy path.
        Assert.True(!own.TryGetProperty("visibilityBlocker", out var noBlocker)
                    || noBlocker.ValueKind == JsonValueKind.Null);

        var brand = _factory.CreateClient();
        await brand.RegisterAndLogin($"vis-brand-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");

        Assert.Contains(creatorId, await FindIds(brand, handle));
        Assert.Equal(HttpStatusCode.OK, (await brand.GetAsync($"/api/creators/{creatorId}")).StatusCode);

        // A typed handle is not a connection: drop the OAuth tokens.
        await _factory.MakeTikTokManual(creatorEmail);

        var hidden = await Data(await creator.GetAsync("/api/creator/profile"));
        Assert.False(hidden.GetProperty("visibleToBrands").GetBoolean());
        Assert.Contains("TikTok", hidden.GetProperty("visibilityBlocker").GetString());

        Assert.DoesNotContain(creatorId, await FindIds(brand, handle));
        Assert.Equal(HttpStatusCode.NotFound, (await brand.GetAsync($"/api/creators/{creatorId}")).StatusCode);

        // Reconnecting brings the profile back.
        await _factory.ConnectTikTok(creatorEmail);
        Assert.Contains(creatorId, await FindIds(brand, handle));
    }

    private static async Task<List<string>> FindIds(HttpClient brand, string search)
    {
        // recentOnly=false: Hitta hides creators without recent views by default,
        // and this test is about visibility, not recency.
        var res = await brand.GetAsync(
            $"/api/creators/search?search={Uri.EscapeDataString(search)}&recentOnly=false&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var data = await Data(res);
        return [.. data.GetProperty("data").EnumerateArray().Select(x => x.GetProperty("id").GetString()!)];
    }

    [Fact]
    public async Task Brand_cannot_take_a_campaign_live_until_the_org_number_is_verified()
    {
        var email = $"gate-brand-{Guid.NewGuid():N}@test.se";
        var brand = _factory.CreateClient();
        await brand.RegisterAndLogin(email, "Test1234!", "Brand");

        // Not verified: the campaign can be created but never submitted.
        await _factory.MarkOrgVerified(email, verified: false);
        var blockedId = await (await brand.PostAsJsonAsync("/api/campaigns", Campaign("Gate blocked"))).ReadId();

        var blocked = await brand.PostAsync($"/api/campaigns/{blockedId}/publish", null);
        Assert.Equal(HttpStatusCode.BadRequest, blocked.StatusCode);
        Assert.Contains("organisationsnummer", await blocked.Content.ReadAsStringAsync());

        // Verified: the same call goes through and the campaign enters review.
        await _factory.MarkOrgVerified(email);
        Assert.Equal(HttpStatusCode.OK, (await brand.PostAsync($"/api/campaigns/{blockedId}/publish", null)).StatusCode);

        var campaign = await Data(await brand.GetAsync($"/api/campaigns/{blockedId}"));
        Assert.Equal("PendingReview", campaign.GetProperty("status").GetString());
    }

    [Fact]
    public async Task A_creator_without_an_oauth_connection_cannot_apply_for_work()
    {
        var brandEmail = $"gate2-brand-{Guid.NewGuid():N}@test.se";
        var brand = _factory.CreateClient();
        await brand.RegisterAndLogin(brandEmail, "Test1234!", "Brand");
        var campaignId = await (await brand.PostAsJsonAsync("/api/campaigns", Campaign("Gate apply"))).ReadId();
        await brand.PublishAndApproveCampaign(campaignId);

        var creatorEmail = $"gate2-creator-{Guid.NewGuid():N}@test.se";
        var creator = _factory.CreateClient();
        await creator.RegisterAndLogin(creatorEmail, "Test1234!", "Creator");
        await _factory.MakeTikTokManual(creatorEmail);

        var res = await creator.PostAsJsonAsync("/api/applications", new { campaignId, message = "Hej!" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Contains("TikTok", await res.Content.ReadAsStringAsync());

        // With the connection restored the same application is accepted.
        await _factory.ConnectTikTok(creatorEmail);
        Assert.Equal(HttpStatusCode.OK,
            (await creator.PostAsJsonAsync("/api/applications", new { campaignId, message = "Hej!" })).StatusCode);
    }
}
