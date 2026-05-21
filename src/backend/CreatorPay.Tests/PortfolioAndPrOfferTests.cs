using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CreatorPay.Tests.Infrastructure;

namespace CreatorPay.Tests;

/// <summary>
/// Integration tests for the creator portfolio, brand-facing discovery and the PR Hub.
/// Requires Docker (Testcontainers PostgreSQL) — runs in CI.
/// </summary>
[Collection("Integration")]
public class PortfolioAndPrOfferTests(CreatorPayFactory factory)
{
    private readonly CreatorPayFactory _factory = factory;

    private static async Task<string> CreatorProfileId(HttpClient creator)
    {
        var res = await creator.GetAsync("/api/creator/profile");
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("data").GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task Creator_AddsPortfolioItem_BrandSeesItOnPublicProfile()
    {
        var creator = _factory.CreateClient();
        await creator.RegisterAndLogin($"creator-pf-{Guid.NewGuid():N}@test.se", "Test1234!", "Creator");
        var creatorProfileId = await CreatorProfileId(creator);

        var addRes = await creator.PostAsJsonAsync("/api/creator/portfolio", new
        {
            title = "Sommarkampanj för Café X",
            description = "UGC-video med 25k views",
            mediaType = "TikTok",
            mediaUrl = "https://www.tiktok.com/@me/video/123",
            category = "Mat",
            brandName = "Café X",
            views = 25000,
            likes = 1200,
            isFeatured = true
        });
        Assert.Equal(HttpStatusCode.OK, addRes.StatusCode);

        // Brand views the public profile and sees the portfolio item.
        var brand = _factory.CreateClient();
        await brand.RegisterAndLogin($"brand-pf-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");

        var publicRes = await brand.GetAsync($"/api/creators/{creatorProfileId}");
        Assert.Equal(HttpStatusCode.OK, publicRes.StatusCode);
        var body = await publicRes.Content.ReadAsStringAsync();
        Assert.Contains("Sommarkampanj för Café X", body);
        Assert.Contains("Café X", body);
    }

    [Fact]
    public async Task Brand_SendsPrOffer_CreatorAcceptsIt_AndStatsUpdate()
    {
        var creator = _factory.CreateClient();
        await creator.RegisterAndLogin($"creator-pr-{Guid.NewGuid():N}@test.se", "Test1234!", "Creator");
        var creatorProfileId = await CreatorProfileId(creator);

        var brand = _factory.CreateClient();
        await brand.RegisterAndLogin($"brand-pr-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");

        // Send PR offer.
        var sendRes = await brand.PostAsJsonAsync("/api/pr-offers", new
        {
            creatorProfileId,
            title = "Prova vår nya meny",
            message = "Vi bjuder på middag för två mot ett inlägg.",
            offerType = "ProductGifting",
            category = "Mat",
            productDescription = "Middag för två + dryck",
            productValue = 800
        });
        Assert.Equal(HttpStatusCode.OK, sendRes.StatusCode);
        using var sendDoc = JsonDocument.Parse(await sendRes.Content.ReadAsStringAsync());
        var offerId = sendDoc.RootElement.GetProperty("data").GetProperty("id").GetString()!;

        // Duplicate pending offer is rejected.
        var dupRes = await brand.PostAsJsonAsync("/api/pr-offers", new
        {
            creatorProfileId, title = "Igen", message = "Andra erbjudandet", offerType = "ProductGifting", category = "Mat"
        });
        Assert.Equal(HttpStatusCode.Conflict, dupRes.StatusCode);

        // Creator sees it in their inbox.
        var receivedRes = await creator.GetAsync("/api/pr-offers/received");
        Assert.Equal(HttpStatusCode.OK, receivedRes.StatusCode);
        Assert.Contains("Prova vår nya meny", await receivedRes.Content.ReadAsStringAsync());

        // Creator accepts.
        var respondRes = await creator.PostAsJsonAsync($"/api/pr-offers/{offerId}/respond",
            new { accept = true, responseMessage = "Låter kul!" });
        Assert.Equal(HttpStatusCode.OK, respondRes.StatusCode);

        // Brand stats reflect one accepted offer.
        var statsRes = await brand.GetAsync("/api/pr-offers/sent/stats");
        Assert.Equal(HttpStatusCode.OK, statsRes.StatusCode);
        using var statsDoc = JsonDocument.Parse(await statsRes.Content.ReadAsStringAsync());
        var stats = statsDoc.RootElement.GetProperty("data");
        Assert.True(stats.GetProperty("totalSent").GetInt32() >= 1);
        Assert.True(stats.GetProperty("accepted").GetInt32() >= 1);
    }

    [Fact]
    public async Task PrOffer_ToUnknownCreator_ReturnsNotFound()
    {
        var brand = _factory.CreateClient();
        await brand.RegisterAndLogin($"brand-pr2-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");

        var res = await brand.PostAsJsonAsync("/api/pr-offers", new
        {
            creatorProfileId = Guid.NewGuid(),
            title = "Hej", message = "Test", offerType = "ProductGifting", category = "Mat"
        });
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task CreatorSearch_RequiresBrandOrAdmin()
    {
        var creator = _factory.CreateClient();
        await creator.RegisterAndLogin($"creator-search-{Guid.NewGuid():N}@test.se", "Test1234!", "Creator");

        // A creator may not use the brand-facing discovery search.
        var res = await creator.GetAsync("/api/creators/search");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }
}
