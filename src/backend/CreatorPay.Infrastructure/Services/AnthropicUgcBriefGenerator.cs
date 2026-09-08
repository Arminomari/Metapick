using System.Text.Json;
using Anthropic;
using Anthropic.Models.Messages;
using CreatorPay.Application.Ugc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// "Generera brief med AI": one structured-output call to Claude with what
/// Vyrle already knows about the brand. The result is a draft the brand
/// edits — it is never published unread. Activated when Anthropic:ApiKey is set.
/// </summary>
public sealed class AnthropicUgcBriefGenerator : IUgcBriefGenerator
{
    private readonly AnthropicClient _client;
    private readonly string _model;
    private readonly ILogger<AnthropicUgcBriefGenerator> _logger;

    private const string SystemPrompt = """
        Du är en erfaren UGC-strateg som skriver briefs åt små lokala företag i Sverige (restauranger, salonger, butiker, gym).
        Du skriver för TikTok/Reels: vertikalt 9:16, 15–45 sekunder, äkta och avslappnat — inte reklamfilm.
        Skriv på svenska, konkret och kort. Hooks ska vara färdiga första meningar som kan sägas i bild.
        "Dos" och "donts" ska vara filmbara instruktioner, inte allmänna råd. Inga påhittade fakta om företaget:
        hänvisa till det du fått, annars formulera generellt. Svara enbart med JSON enligt schemat.
        """;

    public AnthropicUgcBriefGenerator(IConfiguration config, ILogger<AnthropicUgcBriefGenerator> logger)
    {
        _client = new AnthropicClient { ApiKey = config["Anthropic:ApiKey"] };
        _model = config["Anthropic:Model"] ?? "claude-opus-5";
        _logger = logger;
    }

    public bool IsConfigured => true;

    public async Task<UgcBriefDto> GenerateAsync(UgcBriefContext c, CancellationToken ct = default)
    {
        var prompt = $"""
            Företag: {c.CompanyName}
            Bransch: {c.Industry ?? "okänd"}
            Beskrivning: {c.Description ?? "-"}
            Webbplats: {c.Website ?? "-"}

            Mål med videon: {c.Goal ?? "fler kunder"}
            Produkt/tjänst som ska visas: {c.ProductOrService ?? "-"}
            Målgrupp: {c.Audience ?? "lokala kunder"}
            Ton: {c.Tone ?? "varm, äkta, lite humor"}
            Övrigt: {c.Extra ?? "-"}

            Skriv en UGC-brief för en (1) creator. Fält: goal (1–2 meningar), format (t.ex. "9:16 vertikal, TikTok/Reels"),
            lengthSeconds (15–45), videoCount (1), hooks (3 st), callToAction (en mening), referenceUrls (tom lista om inga),
            dos (3–5 st), donts (3–5 st), extraNotes (kort, valfritt).
            """;

        var response = await _client.Messages.Create(new MessageCreateParams
        {
            Model = _model,
            MaxTokens = 4096,
            System = SystemPrompt,
            Messages = [new() { Role = Role.User, Content = prompt }],
            OutputConfig = new OutputConfig
            {
                Format = new JsonOutputFormat
                {
                    Schema = new Dictionary<string, JsonElement>
                    {
                        ["type"] = JsonSerializer.SerializeToElement("object"),
                        ["properties"] = JsonSerializer.SerializeToElement(new
                        {
                            goal = new { type = "string" },
                            format = new { type = "string" },
                            lengthSeconds = new { type = "integer" },
                            videoCount = new { type = "integer" },
                            hooks = new { type = "array", items = new { type = "string" } },
                            callToAction = new { type = "string" },
                            referenceUrls = new { type = "array", items = new { type = "string" } },
                            dos = new { type = "array", items = new { type = "string" } },
                            donts = new { type = "array", items = new { type = "string" } },
                            extraNotes = new { type = "string" },
                        }),
                        ["required"] = JsonSerializer.SerializeToElement(new[] { "goal", "format", "lengthSeconds", "videoCount", "hooks", "callToAction", "referenceUrls", "dos", "donts", "extraNotes" }),
                        ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
                    },
                },
            },
        }, cancellationToken: ct);

        if (response.StopReason == "refusal")
            throw new InvalidOperationException("AI:n avböjde att skriva den här briefen. Justera underlaget och försök igen.");

        var text = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
        if (string.IsNullOrWhiteSpace(text)) throw new InvalidOperationException("Tomt svar från AI:n.");

        var parsed = JsonSerializer.Deserialize<BriefJson>(text, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                     ?? throw new InvalidOperationException("Kunde inte tolka AI-svaret.");

        _logger.LogInformation("UGC AI brief generated for {Company} ({In} in / {Out} out tokens)", c.CompanyName, response.Usage.InputTokens, response.Usage.OutputTokens);
        return new UgcBriefDto(
            parsed.Goal?.Trim() ?? "", parsed.Format?.Trim() ?? "9:16 vertikal, TikTok/Reels",
            Math.Clamp(parsed.LengthSeconds ?? 30, 5, 180), Math.Clamp(parsed.VideoCount ?? 1, 1, 10),
            parsed.Hooks ?? [], parsed.CallToAction?.Trim() ?? "", parsed.ReferenceUrls ?? [], parsed.Dos ?? [], parsed.Donts ?? [],
            string.IsNullOrWhiteSpace(parsed.ExtraNotes) ? null : parsed.ExtraNotes.Trim());
    }

    private sealed class BriefJson
    {
        public string? Goal { get; set; }
        public string? Format { get; set; }
        public int? LengthSeconds { get; set; }
        public int? VideoCount { get; set; }
        public string[]? Hooks { get; set; }
        public string? CallToAction { get; set; }
        public string[]? ReferenceUrls { get; set; }
        public string[]? Dos { get; set; }
        public string[]? Donts { get; set; }
        public string? ExtraNotes { get; set; }
    }
}
