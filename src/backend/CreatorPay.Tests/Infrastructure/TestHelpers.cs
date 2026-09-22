using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;

namespace CreatorPay.Tests.Infrastructure;

[CollectionDefinition("Integration")]
public class IntegrationCollection : ICollectionFixture<CreatorPayFactory> { }

/// <summary>Shapes the API accepts, so payload rules live in one place.</summary>
public static class TestMedia
{
    /// <summary>Smallest thing MediaValidation accepts as an uploaded image.</summary>
    public const string Selfie = "https://cdn.example.test/selfie.jpg";
    /// <summary>Luhn-valid Swedish organisation number (OrgNumber.IsValid).</summary>
    public const string OrgNumber = "556677-8899";

    /// <summary>
    /// The TikTok handle a test creator gets. Derived from the email so the
    /// factory and the tests agree without passing it around, and unique per
    /// creator because tiktok_accounts.TikTokUsername is unique.
    /// </summary>
    public static string TikTokUsername(string email)
    {
        var local = email.Split('@')[0];
        var clean = new string(local.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        return "tt" + (clean.Length > 22 ? clean[..22] : clean);
    }

    /// <summary>
    /// A video URL on the client's own connected account. Submitting someone
    /// else's video is refused, so tests must post their own.
    /// </summary>
    public static string VideoUrl(HttpClient client, long videoId)
        => $"https://www.tiktok.com/@{TikTokUsername(client.TestEmail())}/video/{videoId}";
}

public static class HttpClientExtensions
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static async Task<T?> GetData<T>(this HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        var wrapper = JsonSerializer.Deserialize<ApiResponse<T>>(content, JsonOptions);
        return wrapper == null ? default : wrapper.Data;
    }

    /// <summary>
    /// Takes a campaign live the way the product does: the brand publishes it,
    /// which puts it in review, and VYRLE approves it. Restores the caller's
    /// own token afterwards.
    /// </summary>
    public static async Task PublishAndApproveCampaign(this HttpClient brandClient, string campaignId)
    {
        (await brandClient.PostAsync($"/api/campaigns/{campaignId}/publish", null)).EnsurePublished();

        var brandAuth = brandClient.DefaultRequestHeaders.Authorization;
        await brandClient.LoginAs("admin@metapick.se", "Admin123!");
        var approve = await brandClient.PostAsync($"/api/admin/campaigns/{campaignId}/approve", null);
        if (!approve.IsSuccessStatusCode)
            throw new Exception($"Campaign approval failed ({(int)approve.StatusCode}): {await approve.Content.ReadAsStringAsync()}");
        brandClient.DefaultRequestHeaders.Authorization = brandAuth;
    }

    /// <summary>
    /// Publishing is a precondition for everything that follows; letting it fail
    /// silently turns the next call into a confusing 409.
    /// </summary>
    public static HttpResponseMessage EnsurePublished(this HttpResponseMessage res)
    {
        if (!res.IsSuccessStatusCode)
            throw new Exception($"Publish failed ({(int)res.StatusCode} {res.StatusCode}): {res.Content.ReadAsStringAsync().GetAwaiter().GetResult()}");
        return res;
    }

    /// <summary>
    /// The id from a successful envelope. Fails with the status and the body
    /// instead of a bare KeyNotFoundException when the call did not succeed.
    /// </summary>
    public static async Task<string> ReadId(this HttpResponseMessage res)
    {
        var body = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
            throw new Exception($"Expected success, got {(int)res.StatusCode} {res.StatusCode}: {body}");
        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            throw new Exception($"No data object in response ({(int)res.StatusCode}): {body}");
        return data.GetProperty("id").GetString()!;
    }

    private const string TestEmailHeader = "X-Test-Email";

    /// <summary>The account this client last registered as.</summary>
    public static string TestEmail(this HttpClient client)
        => client.DefaultRequestHeaders.TryGetValues(TestEmailHeader, out var values)
            ? values.First()
            : throw new Exception("This client has not registered; call RegisterAndLogin first.");

    private static void RememberTestEmail(this HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Remove(TestEmailHeader);
        client.DefaultRequestHeaders.Add(TestEmailHeader, email);
    }

    public static async Task<HttpClient> LoginAs(this HttpClient client, string email, string password)
    {
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        if (!res.IsSuccessStatusCode) throw new Exception($"Login failed ({res.StatusCode}): {await res.Content.ReadAsStringAsync()}");
        var auth = await res.GetData<AuthResponseDto>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return client;
    }

    public static async Task<HttpClient> RegisterAndLogin(this HttpClient client, string email, string password,
        string role, string firstName = "Test", string lastName = "User")
    {
        // Register — include the role-specific fields the RegisterRequestValidator requires.
        object payload = role switch
        {
            "Creator" => new
            {
                email, password, firstName, lastName, role,
                displayName = $"{firstName} Creator",
                bio = "Integration test creator profile.",
                category = "Tech",
                country = "SE",
                tikTokUsername = "tt_" + Guid.NewGuid().ToString("N")[..8],
                profileTags = new[] { "UGC Creator" },
                // Identity verification: a creator cannot register without one.
                selfieUrl = TestMedia.Selfie
            },
            "Brand" => new
            {
                email, password, firstName, lastName, role,
                companyName = $"{firstName} Co",
                organizationNumber = TestMedia.OrgNumber
            },
            _ => new { email, password, firstName, lastName, role }
        };
        var regRes = await client.PostAsJsonAsync("/api/auth/register", payload);

        if (!regRes.IsSuccessStatusCode)
        {
            var body = await regRes.Content.ReadAsStringAsync();
            if (!body.Contains("already exists"))
                throw new Exception($"Register failed: {body}");
        }

        // Registration only sends the confirmation link; tests cannot click it, and
        // applying for work requires a proven inbox and an OAuth TikTok connection.
        if (CreatorPayFactory.Current is { } fixtureFactory)
        {
            await fixtureFactory.MarkEmailVerified(email);
            if (role == "Creator") await fixtureFactory.ConnectTikTok(email);
            // Publishing a campaign or ordering video needs a registry-verified number.
            if (role == "Brand") await fixtureFactory.MarkOrgVerified(email);
        }

        // Approve via admin
        var adminClient = client;
        // Save current auth
        var prevAuth = client.DefaultRequestHeaders.Authorization;

        await client.LoginAs("admin@metapick.se", "Admin123!");

        // Find the user and approve
        var usersRes = await client.GetAsync("/api/admin/users?status=PendingVerification&pageSize=100");
        if (usersRes.IsSuccessStatusCode)
        {
            var usersContent = await usersRes.Content.ReadAsStringAsync();
            // Parse to find user by email
            using var doc = JsonDocument.Parse(usersContent);
            if (doc.RootElement.TryGetProperty("data", out var data) &&
                data.TryGetProperty("data", out var usersArray))
            {
                foreach (var u in usersArray.EnumerateArray())
                {
                    if (u.GetProperty("email").GetString() == email)
                    {
                        var userId = u.GetProperty("id").GetString();
                        await client.PostAsync($"/api/admin/users/{userId}/approve", null);
                        break;
                    }
                }
            }
        }

        // Now login as the new user
        await client.LoginAs(email, password);
        client.RememberTestEmail(email);
        return client;
    }
}

// Minimal DTO for auth response deserialization
public record AuthResponseDto(string AccessToken, string RefreshToken, string ExpiresAt);
