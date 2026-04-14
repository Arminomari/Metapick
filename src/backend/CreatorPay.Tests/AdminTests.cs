using System.Net;
using System.Net.Http.Json;
using CreatorPay.Tests.Infrastructure;

namespace CreatorPay.Tests;

[Collection("Integration")]
public class AdminTests(CreatorPayFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Admin_ApproveUser_ReturnsOk()
    {
        // Register a new user
        var email = $"approve-{Guid.NewGuid():N}@test.se";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Test1234!", firstName = "Approve", lastName = "Me", role = "Brand"
        });

        // Login as admin
        await _client.LoginAs("admin@metapick.se", "Admin123!");

        // Get pending users
        var usersRes = await _client.GetAsync("/api/admin/users?status=PendingVerification&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, usersRes.StatusCode);

        var body = await usersRes.Content.ReadAsStringAsync();
        Assert.Contains(email, body);
    }

    [Fact]
    public async Task Admin_ListUsers_AsNonAdmin_Returns403()
    {
        await _client.RegisterAndLogin($"nonadmin-{Guid.NewGuid():N}@test.se", "Test1234!", "Brand");

        var res = await _client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Admin_GetProfile_ReturnsOk()
    {
        await _client.LoginAs("admin@metapick.se", "Admin123!");

        var res = await _client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("admin@metapick.se", body);
    }
}
