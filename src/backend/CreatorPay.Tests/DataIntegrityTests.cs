using CreatorPay.Application.Interfaces;
using CreatorPay.Application.Services;
using CreatorPay.Domain.Common;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using Microsoft.Extensions.Logging.Abstractions;

namespace CreatorPay.Tests;

/// <summary>
/// Block A (dataintegritet): SYSTEM_COMPUTED numbers come from the server, badges
/// only render on real verification, insights need a minimum sample, and
/// aggregates never include draft budgets. Pure unit tests — no database.
/// </summary>
public class DataIntegrityTests
{
    private static readonly DateTime Now = new(2026, 9, 21, 12, 0, 0, DateTimeKind.Utc);

    // ── Organisation numbers ────────────────────────────────────────────

    [Theory]
    [InlineData("556036-0793", true)]   // valid Luhn
    [InlineData("5560360793", true)]
    [InlineData("16 5560360793", true)] // 12-digit form
    [InlineData("556036-0794", false)]  // wrong check digit
    [InlineData("123", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    [InlineData("011201-1234", false)]  // third digit < 2 = personal-number pattern
    public void OrgNumber_Luhn_decides_format_validity(string? raw, bool expected)
        => Assert.Equal(expected, OrgNumber.IsValid(raw));

    [Fact]
    public void OrgNumber_normalises_to_ten_digits_with_dash()
    {
        Assert.Equal("556036-0793", OrgNumber.Normalize(" 5560360793 "));
        Assert.Equal("556036079301", OrgNumber.ToVatNumber("556036-0793"));
        Assert.Null(OrgNumber.Normalize("12345"));
    }

    private sealed class FakeRegistry(OrgRegistryResult result) : IOrgNumberRegistry
    {
        public int Calls;
        public Task<OrgRegistryResult> LookupAsync(string tenDigitOrgNumber, CancellationToken ct = default)
        { Calls++; return Task.FromResult(result); }
    }

    private static BrandProfile Brand(string? org, bool verified = false) => new()
    {
        Id = Guid.NewGuid(), UserId = Guid.NewGuid(), CompanyName = "Café X", Industry = "Mat", Country = "SE",
        OrganizationNumber = org, OrgVerified = verified, OrgVerifiedAt = verified ? Now.AddDays(-30) : null,
        OrgVerificationSource = verified ? "Vies" : null,
    };

    [Fact]
    public async Task OrgVerified_is_set_only_when_the_registry_confirms()
    {
        var registry = new FakeRegistry(new OrgRegistryResult(true, "CAFÉ X AB", "Vies"));
        var svc = new OrgVerificationService(registry, NullLogger<OrgVerificationService>.Instance);
        var brand = Brand("556036-0793");

        var outcome = await svc.VerifyAsync(brand, numberChanged: true);

        Assert.True(outcome.Verified);
        Assert.True(brand.OrgVerified);
        Assert.Equal("CAFÉ X AB", brand.OrgVerifiedName);
        Assert.Equal("Vies", brand.OrgVerificationSource);
        Assert.NotNull(brand.OrgVerifiedAt);
        Assert.Equal(1, registry.Calls);
    }

    [Fact]
    public async Task Invalid_check_digit_never_reaches_the_registry()
    {
        var registry = new FakeRegistry(new OrgRegistryResult(true, "X", "Vies"));
        var svc = new OrgVerificationService(registry, NullLogger<OrgVerificationService>.Instance);
        var brand = Brand("556036-0794", verified: true);

        var outcome = await svc.VerifyAsync(brand, numberChanged: true);

        Assert.False(outcome.Verified);
        Assert.False(brand.OrgVerified);
        Assert.Equal(0, registry.Calls);
    }

    [Fact]
    public async Task Registry_not_found_revokes_but_an_outage_keeps_an_existing_verification()
    {
        var notFound = new OrgVerificationService(new FakeRegistry(new OrgRegistryResult(false, null, "Vies")), NullLogger<OrgVerificationService>.Instance);
        var b1 = Brand("556036-0793", verified: true);
        Assert.False((await notFound.VerifyAsync(b1, numberChanged: false)).Verified);
        Assert.False(b1.OrgVerified);

        var outage = new OrgVerificationService(new FakeRegistry(new OrgRegistryResult(false, null, "Vies", "Registret kunde inte nås")), NullLogger<OrgVerificationService>.Instance);
        var b2 = Brand("556036-0793", verified: true);
        Assert.True((await outage.VerifyAsync(b2, numberChanged: false)).Verified);
        Assert.True(b2.OrgVerified);

        var b3 = Brand("556036-0793", verified: true);
        Assert.False((await outage.VerifyAsync(b3, numberChanged: true)).Verified);
        Assert.False(b3.OrgVerified);
    }

    [Fact]
    public void A_brand_with_only_a_typed_org_number_is_not_verified()
    {
        var brand = Brand("556036-0793");
        Assert.False(brand.OrgVerified);
        OrgVerificationService.SetByAdmin(brand, true, "CAFÉ X AB");
        Assert.True(brand.OrgVerified);
        Assert.Equal("Admin", brand.OrgVerificationSource);
        OrgVerificationService.SetByAdmin(brand, false, null);
        Assert.False(brand.OrgVerified);
    }

    // ── TikTok verification ─────────────────────────────────────────────

    private static TikTokAccount Manual() => new()
    {
        Id = Guid.NewGuid(), TikTokUserId = "anna", TikTokUsername = "anna", FollowerCount = 12_000,
        AccessTokenEncrypted = "", RefreshTokenEncrypted = "", Scopes = "manual", IsActive = true, ConnectedAt = Now.AddDays(-3),
    };

    private static TikTokAccount OAuth(int followers = 12_000, DateTime? lastSync = null) => new()
    {
        Id = Guid.NewGuid(), TikTokUserId = "open-id", TikTokUsername = "anna", FollowerCount = followers,
        AccessTokenEncrypted = "enc", RefreshTokenEncrypted = "enc", Scopes = "user.info.basic,video.list", IsActive = true,
        ConnectedAt = Now.AddDays(-3), LastSyncAt = lastSync,
    };

    [Fact]
    public void Typed_handle_is_never_verified_and_shows_zero_followers()
    {
        var manual = Manual();
        Assert.False(manual.IsVerified());
        Assert.Equal(0, manual.VerifiedFollowers());
        Assert.Null(manual.FollowersSyncedAt());

        var oauth = OAuth(lastSync: Now.AddHours(-1));
        Assert.True(oauth.IsVerified());
        Assert.Equal(12_000, oauth.VerifiedFollowers());
        Assert.Equal(Now.AddHours(-1), oauth.FollowersSyncedAt());

        TikTokAccount? none = null;
        Assert.False(none.IsVerified());
        Assert.Equal(0, none.VerifiedFollowers());
    }

    // ── Portfolio ───────────────────────────────────────────────────────

    [Fact]
    public void Portfolio_brand_is_verified_only_through_a_real_collaboration_link()
    {
        var free = new PortfolioItem { Title = "x", MediaUrl = "https://a", BrandName = "Nobu" };
        Assert.False(free.BrandVerified);
        var linked = new PortfolioItem { Title = "x", MediaUrl = "https://a", BrandName = "Café X", CampaignId = Guid.NewGuid() };
        Assert.True(linked.BrandVerified);
    }

    // ── Policies ────────────────────────────────────────────────────────

    [Fact]
    public void Click_counts_once_per_visitor_per_window()
    {
        Assert.True(ClickPolicy.ShouldCount(null, Now));
        Assert.False(ClickPolicy.ShouldCount(Now.AddHours(-1), Now));
        Assert.True(ClickPolicy.ShouldCount(Now.AddHours(-25), Now));
    }

    [Fact]
    public void Auto_approve_window_is_one_policy()
    {
        var submitted = Now.AddHours(-10);
        Assert.Equal(submitted.AddHours(48), ReviewPolicy.AutoApproveAt(submitted));
        Assert.Equal(38, ReviewPolicy.HoursUntilAutoApprove(submitted, Now));
        Assert.Equal(0, ReviewPolicy.HoursUntilAutoApprove(Now.AddHours(-50), Now));
    }

    [Theory]
    [InlineData(0, "Rising", 0)]
    [InlineData(2_500, "Rising", 50)]
    [InlineData(5_000, "Established", 0)]
    [InlineData(24_999, "Established", 100)]
    [InlineData(600_000, "Icon", 100)]
    public void Creator_level_follows_paid_out_money(decimal paid, string tier, int progress)
    {
        Assert.Equal(tier, CreatorLevels.For(paid).Name);
        Assert.Equal(progress, CreatorLevels.ProgressPercent(paid));
    }

    // ── Brand analytics ─────────────────────────────────────────────────

    private static SocialPost Post(long views, long likes = 0, long shares = 0, VerificationStatus status = VerificationStatus.Verified,
        int? duration = null, DateTime? published = null, bool synced = true, string? caption = null) => new()
    {
        Id = Guid.NewGuid(), TikTokVideoId = Guid.NewGuid().ToString("N"), TikTokUrl = "https://t/v", IsActive = true,
        VerificationStatus = status, LatestViewCount = views, LatestLikeCount = likes, LatestShareCount = shares,
        Duration = duration, PublishedAt = published ?? Now.AddDays(-2), MetricsUpdatedAt = synced ? Now.AddMinutes(-11) : null,
        Caption = caption,
    };

    private static CreatorCampaignAssignment Assignment(long verifiedViews, decimal earned, params SocialPost[] posts)
    {
        var creator = new CreatorProfile { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), DisplayName = "Anna", Category = "Mat", Country = "SE", TikTokAccount = OAuth() };
        var a = new CreatorCampaignAssignment
        {
            Id = Guid.NewGuid(), CreatorProfileId = creator.Id, CreatorProfile = creator,
            Status = AssignmentStatus.Active, TotalVerifiedViews = verifiedViews, CurrentPayoutAmount = earned,
        };
        foreach (var p in posts) { p.AssignmentId = a.Id; a.SocialPosts.Add(p); }
        return a;
    }

    private static Campaign Campaign(string name, CampaignStatus status, decimal budget, DateTime? end = null, params CreatorCampaignAssignment[] assignments)
    {
        var c = new Campaign
        {
            Id = Guid.NewGuid(), Name = name, Description = "", Country = "SE", Category = "Mat", RequiredHashtag = "#x",
            Status = status, Budget = budget, StartDate = Now.AddDays(-30), EndDate = end ?? Now.AddDays(30),
        };
        foreach (var a in assignments) { a.CampaignId = c.Id; a.Campaign = c; c.Assignments.Add(a); }
        return c;
    }

    [Fact]
    public void Remaining_budget_ignores_drafts_and_finished_campaigns()
    {
        // The "464 445 kr kvar" regression: a draft with a huge budget must not leak into "kvar".
        var draft = Campaign("Utkast", CampaignStatus.Draft, 464_445m);
        var pending = Campaign("Granskas", CampaignStatus.PendingReview, 99_000m);
        var active = Campaign("Aktiv", CampaignStatus.Active, 10_000m, null, Assignment(20_000, 2_000m));
        var done = Campaign("Klar", CampaignStatus.Completed, 8_000m, null, Assignment(50_000, 8_000m));
        var expiredActive = Campaign("Passerad", CampaignStatus.Active, 5_000m, Now.AddDays(-1), Assignment(1_000, 500m));

        var s = BrandAnalyticsCalculator.Compute([draft, pending, active, done, expiredActive], Now, TimeZoneInfo.Utc);

        Assert.Equal(3, s.CampaignsInScope);
        Assert.Equal(1, s.RunningCampaigns);
        Assert.Equal(8_000m, s.RemainingBudget);          // only the running campaign
        Assert.Equal(23_000m, s.TotalBudget);             // active + completed + expired; never the draft
        Assert.Equal(10_500m, s.TotalSpent);
        Assert.Equal(71_000, s.TotalViews);
        Assert.DoesNotContain(s.Campaigns, r => r.Name == "Utkast");
        // Invariants a client can rely on
        Assert.True(s.RemainingBudget <= s.Campaigns.Where(r => r.Running).Sum(r => r.Budget));
        Assert.True(s.RemainingBudget >= 0);
        Assert.NotNull(s.Cpm);
        Assert.Equal(Math.Round(10_500m / 71_000m * 1000m, 2), s.Cpm);
    }

    [Fact]
    public void Engagement_only_counts_verified_posts_and_ratios_are_null_without_a_denominator()
    {
        var verified = Post(1_000, likes: 50, shares: 10);
        var unverified = Post(900_000, likes: 5_000, shares: 900, status: VerificationStatus.Pending);
        var c = Campaign("A", CampaignStatus.Active, 1_000m, null, Assignment(1_000, 100m, verified, unverified));

        var s = BrandAnalyticsCalculator.Compute([c], Now, TimeZoneInfo.Utc);

        Assert.Equal(1, s.VerifiedPosts);
        Assert.Equal(2, s.TotalPosts);
        Assert.Equal(50, s.TotalLikes);
        Assert.Equal(10, s.TotalShares);
        Assert.Equal(6.0, s.EngagementRate);
        Assert.Equal(0, s.VideosOver100K);
        Assert.Null(s.CostPerClick);      // no clicks
        Assert.Null(s.AttentionScore);    // fewer than 3 verified posts
        Assert.Equal(verified.MetricsUpdatedAt, s.MetricsUpdatedAt);

        var empty = BrandAnalyticsCalculator.Compute([], Now, TimeZoneInfo.Utc);
        Assert.Null(empty.Cpm);
        Assert.Null(empty.EngagementRate);
        Assert.Null(empty.AvgViewsPerPost);
        Assert.True(empty.LowData);
    }

    [Fact]
    public void One_video_is_not_an_insight()
    {
        var c = Campaign("A", CampaignStatus.Active, 5_000m, null,
            Assignment(975, 200m, Post(975, duration: 12, published: Now.Date.AddHours(20))));

        var s = BrandAnalyticsCalculator.Compute([c], Now, TimeZoneInfo.Utc);

        Assert.Empty(s.Insights);
        Assert.True(s.LowData);
        Assert.Equal(5, s.Thresholds.MinVideosPerBucket);
        // the buckets still exist for charts, but with their real sample size
        Assert.Equal(1, s.DurationBuckets.Single(b => b.Key == "0-15").Count);
        Assert.Equal(1, s.Dayparts.Single(b => b.Key == "evening").Count);
    }

    [Fact]
    public void Insights_appear_once_every_bucket_has_the_minimum_sample()
    {
        var posts = new List<SocialPost>();
        for (var i = 0; i < 5; i++) posts.Add(Post(10_000 + i, duration: 10, published: Now.Date.AddHours(8)));   // short, morning
        for (var i = 0; i < 5; i++) posts.Add(Post(2_000 + i, duration: 50, published: Now.Date.AddHours(20)));   // long, evening
        var a = Campaign("A", CampaignStatus.Active, 5_000m, null, Assignment(60_000, 600m, posts.ToArray()));
        var b = Campaign("B", CampaignStatus.Active, 5_000m, null, Assignment(20_000, 400m, Post(20_000, duration: 20, published: Now.Date.AddHours(9))));

        var s = BrandAnalyticsCalculator.Compute([a, b], Now, TimeZoneInfo.Utc);

        Assert.Contains(s.Insights, i => i.Kind == "BestDuration" && i.Subject == "0–15 s" && i.SampleSize == 5);
        Assert.Contains(s.Insights, i => i.Kind == "BestDaypart" && i.Subject == "Morgon 06–11" && i.SampleSize == 6);
        Assert.Contains(s.Insights, i => i.Kind == "LowestCpmCampaign" && i.Subject == "A" && i.SampleSize == 2);
        Assert.False(s.LowData);
        Assert.NotNull(s.AttentionScore);
    }

    [Fact]
    public void Dayparts_use_the_brand_timezone_not_utc()
    {
        // 23:30 UTC on a summer day is 01:30 in Stockholm → "Natt", not "Kväll".
        var p = Post(1_000, published: new DateTime(2026, 7, 1, 23, 30, 0, DateTimeKind.Utc));
        var c = Campaign("A", CampaignStatus.Active, 1_000m, null, Assignment(1_000, 10m, p));
        var stockholm = BrandAnalyticsCalculator.StockholmOrUtc();
        if (stockholm.Id == "UTC") return; // no tz data on this machine — nothing to assert

        var s = BrandAnalyticsCalculator.Compute([c], Now, stockholm);

        Assert.Equal(1, s.Dayparts.Single(b => b.Key == "night").Count);
        Assert.Equal(0, s.Dayparts.Single(b => b.Key == "evening").Count);
    }

    [Fact]
    public void Hashtags_come_only_from_captions_tiktok_returned()
    {
        var synced = Post(100, caption: "Så gott #lunch #cafex", synced: true);
        var manual = Post(100, caption: "#fejk #fejk2 creator wrote this", synced: false);
        var c = Campaign("A", CampaignStatus.Active, 1_000m, null, Assignment(200, 10m, synced, manual));

        var s = BrandAnalyticsCalculator.Compute([c], Now, TimeZoneInfo.Utc);

        Assert.Equal(["cafex", "lunch"], s.TopHashtags.Select(h => h.Tag).OrderBy(x => x));
    }

    // ── Creator analytics ───────────────────────────────────────────────

    [Fact]
    public void Creator_money_split_and_level_follow_the_payout_ledger()
    {
        var creator = new CreatorProfile { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), DisplayName = "Anna", Category = "Mat", Country = "SE", TikTokAccount = Manual() };
        var brand = new BrandProfile { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), CompanyName = "Café X", Industry = "Mat", Country = "SE" };
        var camp = Campaign("Sommar", CampaignStatus.Active, 10_000m);
        camp.BrandProfileId = brand.Id; camp.BrandProfile = brand;
        var a = Assignment(27_500, 1_070m, Post(27_500));
        a.CampaignId = camp.Id; a.Campaign = camp; a.CreatorProfileId = creator.Id; a.CreatorProfile = creator;

        var payouts = new List<PayoutRequest>
        {
            new() { CreatorProfileId = creator.Id, RequestedAmount = 500m, Status = PayoutStatus.Completed, PayoutMethod = "Swish", PayoutDetailsEncrypted = "" },
            new() { CreatorProfileId = creator.Id, RequestedAmount = 200m, Status = PayoutStatus.Pending, PayoutMethod = "Swish", PayoutDetailsEncrypted = "" },
            new() { CreatorProfileId = creator.Id, RequestedAmount = 9_999m, Status = PayoutStatus.Rejected, PayoutMethod = "Swish", PayoutDetailsEncrypted = "" },
        };

        var s = CreatorAnalyticsCalculator.Compute(creator, [a], payouts, [], prValueDeclared: 300m, availableToWithdraw: 370m, Now, topCreatorThreshold: null);
        Assert.False(s.VerifiedCreator);         // typed handle
        Assert.False(s.TopCreator);

        Assert.Equal(27_500, s.TotalVerifiedViews);
        Assert.Equal(1_070m, s.TotalEarned);
        Assert.Equal(500m, s.PaidOut);
        Assert.Equal(200m, s.Pending);
        Assert.Equal(370m, s.Accrued);
        Assert.Equal(2, s.PayoutCount);           // the rejected one is not money
        Assert.Equal("Rising", s.Level.Name);
        Assert.Equal(500m, s.Level.TotalPaid);
        Assert.Equal(300m, s.PrValueDeclared);
        Assert.False(s.TikTokVerified);           // typed handle
        Assert.Equal(0, s.Followers);
        Assert.Equal(Math.Round(1_070m / 27_500m * 1000m, 2), s.EarningsPerThousandViews);
        Assert.Single(s.TopBrands);
        Assert.Equal("Café X", s.TopBrands[0].BrandName);
    }

    // ── Badges (block B) ────────────────────────────────────────────────

    [Fact]
    public void Verified_creator_needs_oauth_and_a_verified_video()
    {
        Assert.False(CreatorBadges.IsVerifiedCreator(tikTokVerified: false, verifiedPosts: 5));
        Assert.False(CreatorBadges.IsVerifiedCreator(tikTokVerified: true, verifiedPosts: 0));
        Assert.True(CreatorBadges.IsVerifiedCreator(tikTokVerified: true, verifiedPosts: 1));
    }

    [Fact]
    public void Top_creator_is_the_top_decile_of_a_real_population()
    {
        Assert.Null(CreatorBadges.TopCreatorThreshold([50_000, 40_000, 30_000]));   // too few creators for a percentile
        var population = Enumerable.Range(1, 20).Select(i => (long)i * 1000).ToList(); // 1 000 … 20 000
        var threshold = CreatorBadges.TopCreatorThreshold(population);
        Assert.Equal(19_000, threshold);                                            // top 10 % of 20 = 2 creators
        Assert.True(CreatorBadges.IsTopCreator(19_000, verifiedPosts: 3, threshold));
        Assert.False(CreatorBadges.IsTopCreator(19_000, verifiedPosts: 2, threshold)); // one viral video is not a body of work
        Assert.False(CreatorBadges.IsTopCreator(18_000, verifiedPosts: 9, threshold));
        Assert.False(CreatorBadges.IsTopCreator(1_000_000, verifiedPosts: 9, null));
        Assert.Null(CreatorBadges.TopCreatorThreshold(Enumerable.Repeat(0L, 50).ToList())); // zeros are not a population
    }

    [Fact]
    public void Portfolio_engagement_only_from_the_creators_own_verified_video()
    {
        Assert.Equal("7300000000000000001", CreatorBadges.TikTokVideoId("https://www.tiktok.com/@anna/video/7300000000000000001?lang=sv"));
        Assert.Null(CreatorBadges.TikTokVideoId("https://www.instagram.com/p/abc/"));

        var verified = new Dictionary<string, CreatorBadgeService.VerifiedPost>
        {
            ["7300000000000000001"] = new("7300000000000000001", 32_000, 1_200, Now),
        };
        var own = new PortfolioItem { Title = "x", MediaType = PortfolioMediaType.TikTok, MediaUrl = "https://www.tiktok.com/@anna/video/7300000000000000001" };
        var other = new PortfolioItem { Title = "y", MediaType = PortfolioMediaType.TikTok, MediaUrl = "https://www.tiktok.com/@anna/video/7300000000000000009" };
        var image = new PortfolioItem { Title = "z", MediaType = PortfolioMediaType.Image, MediaUrl = "https://a/b.jpg" };

        Assert.Equal(32_000, PortfolioService.MapToDto(own, verified).VerifiedViews);
        Assert.Null(PortfolioService.MapToDto(other, verified).VerifiedViews);   // not a verified campaign video
        Assert.Null(PortfolioService.MapToDto(image, verified).VerifiedViews);
        Assert.Null(PortfolioService.MapToDto(own, null).VerifiedViews);
    }
}
