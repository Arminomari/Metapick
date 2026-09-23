using System.Net;
using System.Net.Http.Json;
using CreatorPay.Tests.Infrastructure;

namespace CreatorPay.Tests;

/// <summary>
/// The campaign form posts a specific shape. These tests send exactly what the
/// UI sends, so a field the API starts requiring fails here instead of on a
/// brand's screen as an unreadable "One or more validation errors occurred."
/// </summary>
[Collection("Integration")]
public class CampaignFormContractTests(CreatorPayFactory factory)
{
    private readonly CreatorPayFactory _factory = factory;

    /// <summary>Mirrors CampaignFormScreen's form state and submit().</summary>
    private static object FormPayload(string model = "Fixed", object[]? payoutRules = null) => new
    {
        name = "Sommarkampanj",
        description = "Visa hur du använder vår nya sommarmeny.",
        country = "SE",
        category = "Övrigt",
        requiredHashtag = "#mittvarumärke",
        payoutModel = model,
        budget = 10000,
        maxCreators = 10,
        requiredVideoCount = 1,
        // The form sends a plain local datetime, not a round-trip UTC string.
        startDate = DateTime.UtcNow.Date.ToString("yyyy-MM-dd") + "T00:00:00",
        endDate = DateTime.UtcNow.Date.AddDays(30).ToString("yyyy-MM-dd") + "T00:00:00",
        reviewMode = "ManualReview",
        minViews = 0,
        requirements = Array.Empty<object>(),
        rules = Array.Empty<object>(),
        payoutRules = payoutRules ?? [new { payoutType = "FixedThreshold", minViews = 1000, amount = 500, sortOrder = 0 }],
        contentInstructions = "",
        perks = "",
        contentTags = Array.Empty<string>(),
    };

    private async Task<HttpClient> Brand()
    {
        var client = _factory.CreateClient();
        await client.RegisterAndLogin($"form-brand-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");
        return client;
    }

    [Theory]
    [InlineData("Fixed")]
    [InlineData("CPM")]
    [InlineData("Tiered")]
    public async Task The_shape_the_campaign_form_posts_is_accepted(string model)
    {
        object[] rules = model switch
        {
            "CPM" => [new { payoutType = "CPM", minViews = 0, amount = 50, sortOrder = 0 }],
            "Tiered" =>
            [
                new { payoutType = "Tiered", minViews = 1000, maxViews = 4999, amount = 200, sortOrder = 0 },
                new { payoutType = "Tiered", minViews = 5000, maxViews = 19999, amount = 500, sortOrder = 1 },
            ],
            _ => [new { payoutType = "FixedThreshold", minViews = 1000, amount = 500, sortOrder = 0 }],
        };

        var brand = await Brand();
        var res = await brand.PostAsJsonAsync("/api/campaigns", FormPayload(model, rules));
        var body = await res.Content.ReadAsStringAsync();
        Assert.True(res.StatusCode == HttpStatusCode.OK, $"{model}: {(int)res.StatusCode} {res.StatusCode} {body}");
    }

    [Fact]
    public async Task A_start_date_in_the_past_is_refused_with_a_readable_swedish_reason()
    {
        var brand = await Brand();
        var yesterday = DateTime.UtcNow.Date.AddDays(-1).ToString("yyyy-MM-dd") + "T00:00:00";
        var payload = new
        {
            name = "Bakåt", description = "Test", country = "SE", category = "Övrigt",
            requiredHashtag = "#bak", payoutModel = "Fixed", budget = 10000, maxCreators = 10,
            requiredVideoCount = 1, startDate = yesterday,
            endDate = DateTime.UtcNow.Date.AddDays(30).ToString("yyyy-MM-dd") + "T00:00:00",
            reviewMode = "ManualReview", minViews = 0,
            requirements = Array.Empty<object>(), rules = Array.Empty<object>(),
            payoutRules = new[] { new { payoutType = "FixedThreshold", minViews = 1000, amount = 500, sortOrder = 0 } },
            contentInstructions = "", perks = "", contentTags = Array.Empty<string>(),
        };
        var res = await brand.PostAsJsonAsync("/api/campaigns", payload);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        // Readable and Swedish: the brand is told what to pick, not a timestamp comparison.
        Assert.Contains("Startdatumet kan inte vara bakåt i tiden", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_rejected_payload_explains_which_field_is_wrong()
    {
        var brand = await Brand();
        // CPM below the floor: the brand must be told the price, not "one or more errors".
        var res = await brand.PostAsJsonAsync("/api/campaigns",
            FormPayload("CPM", [new { payoutType = "CPM", minViews = 0, amount = 5, sortOrder = 0 }]));

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("20 kr", await res.Content.ReadAsStringAsync());
    }
}
