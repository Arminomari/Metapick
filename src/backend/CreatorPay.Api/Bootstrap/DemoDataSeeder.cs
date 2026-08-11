using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CreatorPay.Api.Bootstrap;

/// <summary>
/// Seeds demo brands, campaigns, assignments, a payout and portfolio items so
/// Discover, Dashboard, Mina uppdrag and Portfolio show realistic content for
/// demos and app-store/API reviews (e.g. the TikTok review video).
/// Enabled via Bootstrap:SeedDemoDataEnabled. Idempotent — safe on every boot.
/// Demo brand accounts get a random unguessable password and can never log in.
/// </summary>
public static class DemoDataSeeder
{
    private const string DemoEmailDomain = "demo.vyrle.co";

    private sealed record DemoCampaign(
        string BrandKey, string BrandName, string Industry,
        string Name, string Description, string Category, string Hashtag,
        int MinViews, decimal Amount, string[] Tags, string? Perks);

    // Brands/campaigns mirror the design mockup so the live app matches the demo.
    private static readonly DemoCampaign[] Campaigns =
    [
        new("gymshark", "Gymshark", "Fitness",
            "Gymshark Summer Collection 2026",
            "Visa din träningsstil med nya sommarkollektionen. Skapa energiskt innehåll som inspirerar din publik.",
            "Fashion", "#GymsharkSommar", 20000, 3450m, ["TikTok Video", "Fitness"], "Plagg ur kollektionen ingår"),
        new("nakd", "NA-KD", "Fashion",
            "NA-KD Summer Edit",
            "Styla din sommar med NA-KD. Skapa estetiska outfits och säsongslooks för din publik.",
            "Fashion", "#NAKDSummer", 15000, 4450m, ["TikTok Video", "Fashion"], "Utvalda plagg skickas hem till dig"),
        new("hellofresh", "HelloFresh", "Food",
            "HelloFresh – Vardagsfavoriter",
            "Visa hur enkel och god vardagsmiddagen kan vara med HelloFresh. Laga, smaka och dela din ärliga recension.",
            "Food", "#HelloFreshSE", 20000, 3800m, ["TikTok Video", "Matlagning"], "Två gratis matkassar"),
        new("lyko", "Lyko", "Beauty",
            "Lyko Hair Care",
            "Skapa autentiskt innehåll som visar din favorit-hårvårdsrutin med produkter från Lyko.",
            "Beauty", "#LykoHair", 18000, 2900m, ["TikTok Video", "Beauty"], "PR-paket med hårvård"),
        new("nordvpn", "NordVPN", "Tech",
            "NordVPN – Säker surf",
            "Hjälp din publik att surfa säkrare online. Enkelt, pålitligt och tryggt – visa hur du använder NordVPN i vardagen.",
            "Tech", "#NordVPNSE", 20000, 3200m, ["TikTok Video", "Tech"], "1 års premiumabonnemang"),
        new("novum", "NOVUM", "Fashion",
            "NOVUM Summer Essentials",
            "Tidlösa plagg för sommaren. Skapa rent, minimalistiskt innehåll med lyxig känsla.",
            "Fashion", "#NOVUMEssentials", 15000, 4000m, ["TikTok Video", "Minimal"], null),
        // Campaigns used for the demo creator's assignments (also visible in Discover)
        new("glowup", "Glow UP Skincare", "Beauty",
            "Glow UP Skincare – UGC Video",
            "Visa din hudvårdsrutin med Glow UP och berätta vad du faktiskt tycker. Autentiskt UGC-innehåll för TikTok.",
            "Beauty", "#GlowUPSkin", 15000, 4250m, ["UGC Video", "Beauty"], "Hela hudvårdsserien ingår"),
        new("novaclothing", "Nova Clothing", "Fashion",
            "Nova Clothing – TikTok Video",
            "Skapa en outfit-video med plagg från Nova Clothings nya kollektion.",
            "Fashion", "#NovaClothing", 15000, 2890m, ["TikTok Video", "Fashion"], null),
        new("vitaenergy", "Vita Energy", "Food",
            "Vita Energy – Reel",
            "Visa hur Vita Energy passar in i din träningsvardag. Kort, energiskt format.",
            "Lifestyle", "#VitaEnergy", 15000, 1660m, ["TikTok Video", "Lifestyle"], "Månadsförbrukning av produkten"),
        new("techflow", "TechFlow", "Tech",
            "TechFlow – Short",
            "Visa hur TechFlow förenklar din vardag. Snabb produktdemo i kort format.",
            "Tech", "#TechFlow", 15000, 3480m, ["TikTok Video", "Tech"], null),
    ];

    public static async Task SeedAsync(AppDbContext db, IEncryptionService encryption, string? demoCreatorEmail)
    {
        await SeedBrandsAndCampaignsAsync(db, encryption);
        await SeedCreatorDataAsync(db, encryption, demoCreatorEmail);
    }

    // ── Brands + campaigns (fills Discover for every creator) ──────────
    private static async Task SeedBrandsAndCampaignsAsync(AppDbContext db, IEncryptionService encryption)
    {
        var markerEmail = $"gymshark@{DemoEmailDomain}";
        if (await db.Users.AnyAsync(u => u.Email == markerEmail))
            return;

        var now = DateTime.UtcNow;
        foreach (var (c, i) in Campaigns.Select((c, i) => (c, i)))
        {
            var user = new User
            {
                Email = $"{c.BrandKey}@{DemoEmailDomain}",
                PasswordHash = encryption.HashPassword($"{Guid.NewGuid():N}!Aa1{Guid.NewGuid():N}"),
                FirstName = c.BrandName,
                LastName = "Demo",
                Role = UserRole.Brand,
                Status = UserStatus.Active,
                EmailVerified = true
            };
            db.Users.Add(user);

            var brand = new BrandProfile
            {
                UserId = user.Id,
                CompanyName = c.BrandName,
                Industry = c.Industry,
                Country = "SE",
                Description = $"{c.BrandName} samarbetar med creators via VYRLE.",
                Status = BrandStatus.Approved,
                ReviewedAt = now
            };
            db.Set<BrandProfile>().Add(brand);

            var campaign = new Campaign
            {
                BrandProfileId = brand.Id,
                Name = c.Name,
                Description = c.Description,
                Country = "SE",
                Region = "Nordics",
                Category = c.Category,
                RequiredHashtag = c.Hashtag,
                MinViews = c.MinViews,
                PayoutModel = PayoutModel.Fixed,
                Budget = 50000m,
                MaxCreators = 10,
                RequiredVideoCount = 1,
                // Stagger CreatedAt/StartDate so Discover gets a natural ordering
                CreatedAt = now.AddDays(-(i + 2)),
                StartDate = now.AddDays(-(i + 2)),
                EndDate = now.AddDays(30 - i),
                Status = CampaignStatus.Active,
                ModerationStatus = ModerationStatus.Approved,
                ReviewMode = ReviewMode.ManualReview,
                PublishedAt = now.AddDays(-(i + 2)),
                ContentTags = c.Tags,
                Perks = c.Perks
            };
            db.Set<Campaign>().Add(campaign);

            db.Set<PayoutRule>().Add(new PayoutRule
            {
                CampaignId = campaign.Id,
                PayoutType = PayoutType.FixedThreshold,
                TriggerType = PayoutTriggerType.Views,
                MinViews = c.MinViews,
                Amount = c.Amount,
                Currency = "SEK",
                SortOrder = 0
            });
        }

        await db.SaveChangesAsync();
        Log.Information("Seeded {Count} demo brands + campaigns", Campaigns.Length);
    }

    // ── Assignments, payout + portfolio for the demo creator ───────────
    private static async Task SeedCreatorDataAsync(AppDbContext db, IEncryptionService encryption, string? demoCreatorEmail)
    {
        if (string.IsNullOrWhiteSpace(demoCreatorEmail))
            return;

        var creator = await db.Set<CreatorProfile>()
            .FirstOrDefaultAsync(c => c.User.Email == demoCreatorEmail && !c.IsDeleted);
        if (creator == null)
        {
            Log.Information("Demo data: creator {Email} not found yet — skipping creator seed", demoCreatorEmail);
            return;
        }

        var now = DateTime.UtcNow;

        // (campaign name, status, verified views, earned SEK)
        (string Name, AssignmentStatus Status, long Views, decimal Earned)[] wanted =
        [
            ("Glow UP Skincare – UGC Video", AssignmentStatus.Active, 412_000, 4250m),
            ("Nova Clothing – TikTok Video", AssignmentStatus.Active, 268_000, 2890m),
            ("Vita Energy – Reel", AssignmentStatus.Active, 190_000, 1660m),
            ("TechFlow – Short", AssignmentStatus.Completed, 240_000, 3480m),
        ];

        if (!await db.Set<CreatorCampaignAssignment>().AnyAsync(a => a.CreatorProfileId == creator.Id))
        {
            CreatorCampaignAssignment? completedAssignment = null;
            PayoutRule? completedRule = null;

            foreach (var (w, i) in wanted.Select((w, i) => (w, i)))
            {
                var campaign = await db.Set<Campaign>()
                    .Include(c => c.PayoutRules)
                    .FirstOrDefaultAsync(c => c.Name == w.Name);
                if (campaign == null) continue;

                var application = new CampaignApplication
                {
                    CampaignId = campaign.Id,
                    CreatorProfileId = creator.Id,
                    Message = "Jag vill gärna delta i denna kampanj!",
                    Status = ApplicationStatus.Approved,
                    ReviewedAt = now.AddDays(-(14 - i)),
                    CreatedAt = now.AddDays(-(15 - i))
                };
                db.Set<CampaignApplication>().Add(application);

                var assignment = new CreatorCampaignAssignment
                {
                    CampaignId = campaign.Id,
                    CreatorProfileId = creator.Id,
                    ApplicationId = application.Id,
                    Status = w.Status,
                    ReservedBudget = w.Earned,
                    TotalVerifiedViews = w.Views,
                    CurrentPayoutAmount = w.Earned,
                    AssignedAt = now.AddDays(-(14 - i)),
                    CompletedAt = w.Status == AssignmentStatus.Completed ? now.AddDays(-2) : null
                };
                db.Set<CreatorCampaignAssignment>().Add(assignment);

                if (w.Status == AssignmentStatus.Completed)
                {
                    completedAssignment = assignment;
                    completedRule = campaign.PayoutRules.FirstOrDefault();
                }
            }

            // One completed payout so "Skickat till dig" shows a real number
            if (completedAssignment != null && completedRule != null &&
                !await db.Set<PayoutRequest>().AnyAsync(p => p.CreatorProfileId == creator.Id))
            {
                var calculation = new PayoutCalculation
                {
                    AssignmentId = completedAssignment.Id,
                    CalculatedAmount = completedAssignment.CurrentPayoutAmount,
                    VerifiedViews = completedAssignment.TotalVerifiedViews,
                    PayoutRuleId = completedRule.Id,
                    CalculationDetails = """{"source":"demo-seed"}""",
                    Status = PayoutCalculationStatus.Locked,
                    IsLatest = true,
                    CalculatedAt = now.AddDays(-2),
                    LockedAt = now.AddDays(-2)
                };
                db.Set<PayoutCalculation>().Add(calculation);

                db.Set<PayoutRequest>().Add(new PayoutRequest
                {
                    CreatorProfileId = creator.Id,
                    PayoutCalculationId = calculation.Id,
                    RequestedAmount = completedAssignment.CurrentPayoutAmount,
                    Currency = "SEK",
                    PayoutMethod = "BankTransfer",
                    PayoutDetailsEncrypted = encryption.Encrypt("Demo · **** 1234"),
                    Status = PayoutStatus.Completed,
                    ReviewedAt = now.AddDays(-1)
                });
            }
        }

        // Portfolio (Link items render as gradient case-study tiles)
        if (!await db.Set<PortfolioItem>().AnyAsync(p => p.CreatorProfileId == creator.Id))
        {
            (string Title, string Category, string Brand, long Views, long Likes, bool Featured)[] portfolio =
            [
                ("Nobu Marbella", "Food · Fine Dining", "Nobu", 126_000, 8_400, true),
                ("NA-KD Summer Edit", "Fashion · Apparel", "NA-KD", 312_000, 22_100, true),
                ("Gymshark Performance Series", "Fitness · Activewear", "Gymshark", 278_000, 16_300, false),
                ("HelloFresh Vardagsfavoriter", "Food · Recept", "HelloFresh", 184_000, 10_200, false),
                ("Lyko Beauty Routine", "Beauty · Hudvård", "Lyko", 205_000, 12_700, false),
                ("Soho House Experience", "Lifestyle · Resor", "Soho House", 342_000, 18_600, false),
            ];

            foreach (var (p, i) in portfolio.Select((p, i) => (p, i)))
            {
                db.Set<PortfolioItem>().Add(new PortfolioItem
                {
                    CreatorProfileId = creator.Id,
                    Title = p.Title,
                    Description = $"Samarbete med {p.Brand}.",
                    MediaType = PortfolioMediaType.Link,
                    MediaUrl = "https://www.vyrle.co",
                    Category = p.Category,
                    BrandName = p.Brand,
                    Views = p.Views,
                    Likes = p.Likes,
                    SortOrder = i,
                    IsFeatured = p.Featured
                });
            }
        }

        await db.SaveChangesAsync();
        Log.Information("Seeded demo assignments, payout and portfolio for {Email}", demoCreatorEmail);
    }
}
