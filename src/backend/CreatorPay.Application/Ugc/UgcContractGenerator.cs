using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Ugc;

namespace CreatorPay.Application.Ugc;

/// <summary>Everything the contract text is built from.</summary>
public sealed record UgcContractInput(
    string BrandName,
    string? BrandOrgNumber,
    string CreatorName,
    string Title,
    string BriefText,
    UgcCompensationType Compensation,
    UgcQuote Quote,
    string? ProductDescription,
    long? ProductValueOre,
    UgcRightsPackage RightsPackage,
    int DeadlineDays,
    int AutoApproveDays,
    int MaxRevisions,
    int RevisionDeadlineDays,
    bool CreatorAllowsPortfolioUse,
    string TemplateVersion,
    DateTime Date);

/// <summary>The generated text plus the hash both parties accept.</summary>
public sealed record UgcContract(string Text, string Sha256, string TemplateVersion);

/// <summary>
/// Renders the contract from the Markdown templates embedded under
/// Ugc/Contracts. The templates are the legal source of truth — this class
/// only substitutes placeholders and hashes the result, so a lawyer can change
/// wording without touching code. The same input always yields the same hash.
/// </summary>
public static class UgcContractGenerator
{
    private const string ResourcePrefix = "CreatorPay.Application.Ugc.Contracts.";

    public static UgcContract Generate(UgcContractInput i)
    {
        var text = Load("contract.sv.md")
            .Replace("{{TEMPLATE_VERSION}}", i.TemplateVersion)
            .Replace("{{DATE}}", i.Date.ToString("yyyy-MM-dd"))
            .Replace("{{BRAND_NAME}}", i.BrandName.Trim())
            .Replace("{{BRAND_ORG_LINE}}", string.IsNullOrWhiteSpace(i.BrandOrgNumber) ? "" : $", org.nr {i.BrandOrgNumber.Trim()}")
            .Replace("{{CREATOR_NAME}}", i.CreatorName.Trim())
            .Replace("{{TITLE}}", i.Title.Trim())
            .Replace("{{BRIEF}}", i.BriefText.Trim())
            .Replace("{{COMPENSATION_SECTION}}", CompensationSection(i))
            .Replace("{{DEADLINE_DAYS}}", i.DeadlineDays.ToString())
            .Replace("{{AUTO_APPROVE_DAYS}}", i.AutoApproveDays.ToString())
            .Replace("{{MAX_REVISIONS}}", i.MaxRevisions.ToString())
            .Replace("{{REVISION_DAYS}}", i.RevisionDeadlineDays.ToString())
            .Replace("{{RIGHTS_CLAUSE}}", Load($"rights.{i.RightsPackage}.sv.md"))
            .Replace("{{PLATFORM_LICENSE_CLAUSE}}", Load("clause.platform-license.sv.md")
                .Replace("{{PORTFOLIO_OPT_OUT_NOTE}}", i.CreatorAllowsPortfolioUse ? "" : " Creatorn har avstått från denna visningsrätt vid avtalets ingående."));

        text = StripHtmlComments(text).Replace("\r\n", "\n").Trim() + "\n";
        return new UgcContract(text, Hash(text), i.TemplateVersion);
    }

    /// <summary>The rights clause on its own — quoted on the licence certificate.</summary>
    public static string RightsClause(UgcRightsPackage package)
        => StripHtmlComments(Load($"rights.{package}.sv.md")).Trim();

    /// <summary>The hash of a stored text — to verify nothing changed since acceptance.</summary>
    public static string Hash(string text)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();

    /// <summary>The structured brief as the contract quotes it.</summary>
    public static string RenderBrief(Domain.Entities.UgcCampaign c)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"- **Mål:** {c.Goal}");
        sb.AppendLine($"- **Format:** {c.Format}, ca {c.LengthSeconds} sekunder, {c.VideoCount} video{(c.VideoCount == 1 ? "" : "r")}");
        if (c.Hooks.Length > 0) sb.AppendLine($"- **Hooks:** {string.Join("; ", c.Hooks)}");
        sb.AppendLine($"- **Call to action:** {c.CallToAction}");
        if (c.ReferenceUrls.Length > 0) sb.AppendLine($"- **Referenser:** {string.Join(", ", c.ReferenceUrls)}");
        if (c.Dos.Length > 0) sb.AppendLine($"- **Gör:** {string.Join("; ", c.Dos)}");
        if (c.Donts.Length > 0) sb.AppendLine($"- **Undvik:** {string.Join("; ", c.Donts)}");
        if (!string.IsNullOrWhiteSpace(c.ExtraNotes)) sb.AppendLine($"- **Övrigt:** {c.ExtraNotes}");
        return sb.ToString().Replace("\r\n", "\n").TrimEnd();
    }

    private static string CompensationSection(UgcContractInput i)
    {
        var sb = new StringBuilder();
        var q = i.Quote;

        if (i.Compensation is UgcCompensationType.Paid or UgcCompensationType.PaidPlusProduct)
        {
            sb.AppendLine($"Creatorn erhåller **{UgcFeeCalculator.FormatSek(q.CreatorAmountOre)}** för Leveransen.");
            sb.AppendLine();
            sb.AppendLine($"Företaget betalar {UgcFeeCalculator.FormatSek(q.CreatorAmountOre)} till Creatorn samt VYRLE:s förmedlingsavgift om {q.FeePercent:0.#} % ({UgcFeeCalculator.FormatSek(q.PlatformFeeOre)}), totalt **{UgcFeeCalculator.FormatSek(q.BrandTotalOre)}**. Beloppet betalas i sin helhet vid avtalets ingående och hålls av VYRLE till dess Leveransen godkänts, varefter Creatorns ersättning betalas ut. Vid avbrutet uppdrag utan leverans återbetalas Företaget hela beloppet.");
        }

        if (i.Compensation is UgcCompensationType.ProductExchange or UgcCompensationType.PaidPlusProduct)
        {
            if (sb.Length > 0) sb.AppendLine();
            sb.AppendLine(Load("clause.product-exchange.sv.md")
                .Replace("{{PRODUCT_DESCRIPTION}}", (i.ProductDescription ?? "produkt enligt överenskommelse").Trim())
                .Replace("{{PRODUCT_VALUE_LINE}}", i.ProductValueOre is > 0 ? $" (värde ca {UgcFeeCalculator.FormatSek(i.ProductValueOre.Value)})" : "")
                .Trim());
        }

        return sb.ToString().Replace("\r\n", "\n").TrimEnd();
    }

    private static string Load(string name)
    {
        var asm = typeof(UgcContractGenerator).GetTypeInfo().Assembly;
        using var stream = asm.GetManifestResourceStream(ResourcePrefix + name)
            ?? throw new FileNotFoundException($"Contract template '{name}' is not embedded. Check the csproj EmbeddedResource include.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd().Replace("\r\n", "\n");
    }

    private static string StripHtmlComments(string s)
    {
        // Template comments are for lawyers and developers, not for the parties.
        while (true)
        {
            var start = s.IndexOf("<!--", StringComparison.Ordinal);
            if (start < 0) return s;
            var end = s.IndexOf("-->", start, StringComparison.Ordinal);
            if (end < 0) return s[..start];
            s = s[..start] + s[(end + 3)..];
        }
    }
}
