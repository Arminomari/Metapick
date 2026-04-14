using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;

namespace CreatorPay.Tests.Infrastructure;

[CollectionDefinition("Integration")]
public class IntegrationCollection : ICollectionFixture<CreatorPayFactory> { }

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
        // Register
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password,
            firstName,
            lastName,
            role
        });

        if (!regRes.IsSuccessStatusCode)
        {
            var body = await regRes.Content.ReadAsStringAsync();
            if (!body.Contains("already exists"))
                throw new Exception($"Register failed: {body}");
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
        return client;
    }
}

// Minimal DTO for auth response deserialization
public record AuthResponseDto(string AccessToken, string RefreshToken, string ExpiresAt);
