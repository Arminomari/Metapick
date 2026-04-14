using CreatorPay.Application.Services;
using CreatorPay.Domain.Entities;

namespace CreatorPay.Tests;

/// <summary>
/// Unit tests for ViewConfidenceScorer — verifies confidence signal weights.
/// All five signals must sum to 1.0 when all conditions are met.
/// </summary>
public class ViewConfidenceScorerTests
{
    // Use DateTime.UtcNow as base so Signal 1b timing is deterministic relative to real time.
    private static readonly DateTime Now = DateTime.UtcNow;

    private static TikTokAccount Account(bool isActive = true, bool oldAccount = true) => new()
    {
        Id = Guid.NewGuid(),
        IsActive = isActive,
        // oldAccount = true  → connected 6 months ago (Signal 1b fires)
        // oldAccount = false → connected 5 days ago (Signal 1b does NOT fire)
        ConnectedAt = oldAccount ? Now.AddMonths(-6) : Now.AddDays(-5),
        TikTokUserId = "u1",
        TikTokUsername = "testuser",
        AccessTokenEncrypted = "",
        RefreshTokenEncrypted = "",
        Scopes = "",
    };

    private static SocialPost Post(DateTime? publishedAt = null, string? caption = null) => new()
    {
        Id = Guid.NewGuid(),
        TikTokVideoId = "v1",
        TikTokUrl = "https://tiktok.com/v1",
        Caption = caption,
        PublishedAt = publishedAt ?? Now,
    };

    private static Campaign Campaign(DateTime? start = null, DateTime? end = null, string hashtag = "#test") => new()
    {
        Id = Guid.NewGuid(),
        Name = "Test",
        Description = "",
        Country = "SE",
        Category = "Tech",
        RequiredHashtag = hashtag,
        StartDate = start ?? Now.AddDays(-5),
        EndDate = end ?? Now.AddDays(25),
        BrandProfileId = Guid.NewGuid(),
    };

    private static TrackingTag Tag(string code = "TRACK123") => new()
    {
        Id = Guid.NewGuid(),
        TagCode = code,
        RecommendedHashtag = "#track",
    };

    // ── Signal weights ──────────────────────────────────────────────────────

    [Fact]
    public void AllSignals_MaxScore_IsOne()
    {
        var post = Post(caption: "#test TRACK123");
        var account = Account(isActive: true, oldAccount: true); // both Signal 1a and 1b
        var campaign = Campaign(hashtag: "#test");               // Signal 2 + Signal 3
        var tag = Tag("TRACK123");                               // Signal 4

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, tag);

        Assert.Equal(1.0m, score);
    }

    [Fact]
    public void NoSignals_ReturnsMinimum_FromBaselineSignal5()
    {
        // Inactive account, connected recently, post outside campaign window, no hashtag, no tracking tag
        var post = Post(publishedAt: Now.AddYears(-1));
        var account = Account(isActive: false, oldAccount: false);
        var campaign = Campaign(start: Now.AddDays(1), end: Now.AddDays(30), hashtag: "");

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        // Only Signal 5 baseline (0.05) fires
        Assert.Equal(0.05m, score);
    }

    [Fact]
    public void Signal1a_ActiveAccountAdds015()
    {
        // isActive=true (Signal 1a), not old (Signal 1b won't fire), post outside window, no hashtag
        var post = Post(publishedAt: Now.AddYears(-1));
        var account = Account(isActive: true, oldAccount: false);
        var campaign = Campaign(start: Now.AddDays(5), end: Now.AddDays(30), hashtag: "");

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        // Signal1a (0.15) + Signal5 (0.05) = 0.20
        Assert.Equal(0.20m, score);
    }

    [Fact]
    public void Signal1b_OldAccountAdds015()
    {
        // inactive (Signal 1a won't fire), old account (Signal 1b fires), post outside window
        var post = Post(publishedAt: Now.AddYears(-1));
        var account = Account(isActive: false, oldAccount: true);
        var campaign = Campaign(start: Now.AddDays(5), end: Now.AddDays(30), hashtag: "");

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        // Signal1b (0.15) + Signal5 (0.05) = 0.20
        Assert.Equal(0.20m, score);
    }

    [Fact]
    public void Signal2_PostWithinCampaignPeriodAdds020()
    {
        var campaign = Campaign(start: Now.AddDays(-5), end: Now.AddDays(25));
        var post = Post(publishedAt: Now); // right in the middle of campaign
        var account = Account(isActive: false, oldAccount: false); // no Signal 1

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        // Signal2 (0.20) + Signal5 (0.05) = 0.25
        Assert.Equal(0.25m, score);
    }

    [Fact]
    public void Signal2_PostAtEndDatePlusGraceAdds020()
    {
        var campaign = Campaign();
        // Just within 24h grace period after EndDate
        var post = Post(publishedAt: campaign.EndDate.AddHours(12));
        var account = Account(isActive: false, oldAccount: false);

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        // Signal2 (0.20) + Signal5 (0.05) = 0.25
        Assert.Equal(0.25m, score);
    }

    [Fact]
    public void Signal2_PostOutsideGraceDoesNotFire()
    {
        var campaign = Campaign();
        var post = Post(publishedAt: campaign.EndDate.AddHours(25)); // past grace
        var account = Account(isActive: false, oldAccount: false);

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        // Only Signal5 (0.05)
        Assert.Equal(0.05m, score);
    }

    [Fact]
    public void Signal3_RequiredHashtagPresentAdds020()
    {
        // Post outside campaign window (Signal 2 off), but hashtag matches (Signal 3 on)
        var campaign = Campaign(start: Now.AddDays(-30), end: Now.AddDays(-10), hashtag: "#mybrand");
        var post = Post(publishedAt: Now, caption: "Great video! #mybrand check it out");
        var account = Account(isActive: false, oldAccount: false);

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        // Signal3 (0.20) + Signal5 (0.05) = 0.25
        Assert.Equal(0.25m, score);
    }

    [Fact]
    public void Signal3_CaseInsensitiveHashtagMatch()
    {
        var campaign = Campaign(start: Now.AddDays(-30), end: Now.AddDays(-10), hashtag: "#MYBRAND");
        var post = Post(publishedAt: Now, caption: "check #mybrand out");
        var account = Account(isActive: false, oldAccount: false);

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        // Signal3 fires case-insensitively: 0.20 + 0.05 = 0.25
        Assert.Equal(0.25m, score);
    }

    [Fact]
    public void Signal3_MissingHashtagDoesNotFire()
    {
        var campaign = Campaign(start: Now.AddDays(-30), end: Now.AddDays(-10), hashtag: "#mybrand");
        var post = Post(publishedAt: Now, caption: "no matching tag");
        var account = Account(isActive: false, oldAccount: false);

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        Assert.Equal(0.05m, score); // Signal5 only
    }

    [Fact]
    public void Signal4_TrackingTagPresentAdds025()
    {
        var tag = Tag("TRACK99");
        var campaign = Campaign(start: Now.AddDays(5), end: Now.AddDays(30), hashtag: ""); // post outside window
        var post = Post(publishedAt: Now, caption: "use TRACK99 in your bio");
        var account = Account(isActive: false, oldAccount: false);

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, tag);

        // Signal4 (0.25) + Signal5 (0.05) = 0.30
        Assert.Equal(0.30m, score);
    }

    [Fact]
    public void Signal4_NullTrackingTag_NoBonus()
    {
        var post = Post(publishedAt: Now.AddYears(-1));
        var account = Account(isActive: false, oldAccount: false);
        var campaign = Campaign(start: Now.AddDays(5), end: Now.AddDays(30), hashtag: "");

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, null);

        Assert.Equal(0.05m, score); // Signal5 only
    }

    [Fact]
    public void Score_NeverExceedsOne()
    {
        // All signals firing should not exceed 1.0
        var post = Post(caption: "#test TRACK123");
        var account = Account(isActive: true, oldAccount: true);
        var campaign = Campaign();
        var tag = Tag("TRACK123");

        var score = ViewConfidenceScorer.Calculate(post, account, campaign, tag);

        Assert.True(score <= 1.0m, $"Score {score} exceeded maximum 1.0");
        Assert.True(score >= 0m, $"Score {score} is negative");
    }
}
