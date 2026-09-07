using CreatorPay.Application.Ugc;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Ugc;

namespace CreatorPay.Tests.Ugc;

public class UgcContractGeneratorTests
{
    private static UgcContractInput Input(
        UgcRightsPackage rights = UgcRightsPackage.Organic,
        UgcCompensationType comp = UgcCompensationType.Paid,
        bool portfolio = true,
        string? orgNr = "556677-8899") => new(
        BrandName: "Sushi Bar Söder AB",
        BrandOrgNumber: orgNr,
        CreatorName: "Gustav Lindqvist",
        Title: "Lunchdeal-video",
        BriefText: "- **Mål:** fler lunchgäster",
        Compensation: comp,
        Quote: UgcFeeCalculator.Quote(150_000, 15),
        ProductDescription: "Lunch för två",
        ProductValueOre: 30_000,
        RightsPackage: rights,
        DeadlineDays: 7,
        AutoApproveDays: 5,
        MaxRevisions: 2,
        RevisionDeadlineDays: 3,
        CreatorAllowsPortfolioUse: portfolio,
        TemplateVersion: "2026-09-draft-1",
        Date: new DateTime(2026, 9, 8));

    [Fact]
    public void Same_input_same_hash()
    {
        var a = UgcContractGenerator.Generate(Input());
        var b = UgcContractGenerator.Generate(Input());
        Assert.Equal(a.Text, b.Text);
        Assert.Equal(a.Sha256, b.Sha256);
        Assert.Equal(64, a.Sha256.Length);
        Assert.Equal(a.Sha256, UgcContractGenerator.Hash(a.Text));   // stored text verifies later
    }

    [Fact]
    public void Text_carries_the_deal()
    {
        var c = UgcContractGenerator.Generate(Input()).Text;
        Assert.Contains("Sushi Bar Söder AB", c);
        Assert.Contains("org.nr 556677-8899", c);
        Assert.Contains("Gustav Lindqvist", c);
        Assert.Contains("Lunchdeal-video", c);
        Assert.Contains("fler lunchgäster", c);
        Assert.Contains("1 500,00 kr", c);          // creator amount
        Assert.Contains("225,00 kr", c);            // 15 % fee
        Assert.Contains("1 725,00 kr", c);          // brand total
        Assert.Contains("15 %", c);
        Assert.Contains("7 dagar", c);
        Assert.Contains("5 dagar", c);
        Assert.Contains("2 gånger", c);
        Assert.Contains("3 dagar", c);
        Assert.Contains("2026-09-draft-1", c);
        Assert.Contains("2026-09-08", c);
    }

    [Fact]
    public void Comments_for_lawyers_never_reach_the_parties()
    {
        var c = UgcContractGenerator.Generate(Input()).Text;
        Assert.DoesNotContain("<!--", c);
        Assert.DoesNotContain("JURIDISK GRANSKNING", c);
        Assert.DoesNotContain("{{", c);              // every placeholder filled
    }

    [Theory]
    [InlineData(UgcRightsPackage.Organic, "Organiskt**", "sex (6) månader", false)]
    [InlineData(UgcRightsPackage.OrganicPlusAds6M, "sex (6) månader", "tolv (12) månader", false)]
    [InlineData(UgcRightsPackage.OrganicPlusAds12M, "tolv (12) månader", "sex (6) månader", false)]
    [InlineData(UgcRightsPackage.FullTransfer, "Fullständig överlåtelse", "behåller upphovsrätten", true)]
    public void Rights_package_changes_the_clause(UgcRightsPackage rights, string mustContain, string mustNotContain, bool transfer)
    {
        var c = UgcContractGenerator.Generate(Input(rights)).Text;
        Assert.Contains(mustContain, c);
        Assert.DoesNotContain(mustNotContain, c);
        Assert.Equal(transfer, c.Contains("överlåter"));
    }

    [Fact]
    public void Different_packages_different_hashes()
    {
        var hashes = Enum.GetValues<UgcRightsPackage>()
            .Select(r => UgcContractGenerator.Generate(Input(r)).Sha256)
            .ToHashSet();
        Assert.Equal(4, hashes.Count);
    }

    [Fact]
    public void Product_exchange_has_tax_clause_and_no_fee()
    {
        var c = UgcContractGenerator.Generate(Input(comp: UgcCompensationType.ProductExchange)).Text;
        Assert.Contains("Lunch för två", c);
        Assert.Contains("300,00 kr", c);
        Assert.Contains("skattepliktig inkomst", c);
        Assert.DoesNotContain("förmedlingsavgift", c);
        Assert.DoesNotContain("1 725,00 kr", c);
    }

    [Fact]
    public void Paid_plus_product_has_both()
    {
        var c = UgcContractGenerator.Generate(Input(comp: UgcCompensationType.PaidPlusProduct)).Text;
        Assert.Contains("förmedlingsavgift", c);
        Assert.Contains("skattepliktig inkomst", c);
    }

    [Fact]
    public void Portfolio_opt_out_and_missing_org_number_are_reflected()
    {
        var optOut = UgcContractGenerator.Generate(Input(portfolio: false)).Text;
        Assert.Contains("avstått från denna visningsrätt", optOut);
        Assert.DoesNotContain("avstått från denna visningsrätt", UgcContractGenerator.Generate(Input()).Text);

        var noOrg = UgcContractGenerator.Generate(Input(orgNr: null)).Text;
        Assert.DoesNotContain("org.nr", noOrg);
    }

    [Fact]
    public void Brief_renders_every_filled_field()
    {
        var campaign = new UgcCampaign
        {
            Title = "t", Goal = "Fler bokningar", Format = "9:16", LengthSeconds = 20, VideoCount = 2,
            Hooks = ["Visste du att…", "POV:"], CallToAction = "Boka via länken",
            ReferenceUrls = ["https://tiktok.com/@x/video/1"], Dos = ["Visa menyn"], Donts = ["Ingen musik med copyright"],
            ExtraNotes = "Filma i dagsljus",
        };
        var b = UgcContractGenerator.RenderBrief(campaign);
        Assert.Contains("Fler bokningar", b);
        Assert.Contains("2 videor", b);
        Assert.Contains("Visste du att…; POV:", b);
        Assert.Contains("Boka via länken", b);
        Assert.Contains("Visa menyn", b);
        Assert.Contains("Ingen musik med copyright", b);
        Assert.Contains("Filma i dagsljus", b);

        campaign.VideoCount = 1; campaign.Hooks = []; campaign.ExtraNotes = null;
        var one = UgcContractGenerator.RenderBrief(campaign);
        Assert.Contains("1 video", one);
        Assert.DoesNotContain("1 videor", one);
        Assert.DoesNotContain("Hooks", one);
        Assert.DoesNotContain("Övrigt", one);
    }
}
