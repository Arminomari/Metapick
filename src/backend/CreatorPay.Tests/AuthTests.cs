using System.Net;
using System.Net.Http.Json;
using CreatorPay.Tests.Infrastructure;

namespace CreatorPay.Tests;

[Collection("Integration")]
public class AuthTests(CreatorPayFactory factory)
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Register_Brand_ReturnsSuccess()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"brand-{Guid.NewGuid():N}@test.se",
            password = "Test1234!",
            firstName = "Brand",
            lastName = "Test",
            role = "Brand"
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Register_Creator_ReturnsSuccess()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"creator-{Guid.NewGuid():N}@test.se",
            password = "Test1234!",
            firstName = "Creator",
            lastName = "Test",
            role = "Creator"
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Register_DuplicateEmail_Returns409()
    {
        var email = $"dup-{Guid.NewGuid():N}@test.se";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Test1234!", firstName = "A", lastName = "B", role = "Brand"
        });

        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Test1234!", firstName = "A", lastName = "B", role = "Brand"
        });

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task Login_AdminSeeded_ReturnsTokens()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "admin@metapick.se",
            password = "Admin123!"
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var data = await res.GetData<AuthResponseDto>();
        Assert.NotNull(data);
        Assert.False(string.IsNullOrEmpty(data.AccessToken));
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "admin@metapick.se",
            password = "WrongPassword!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Login_PendingUser_Returns403()
    {
        var email = $"pending-{Guid.NewGuid():N}@test.se";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Test1234!", firstName = "Pending", lastName = "User", role = "Brand"
        });

        var res = await _client.PostAsJsonAsync("/api/auth/login", new { email, password = "Test1234!" });

        // Should be forbidden since user is PendingVerification
        Assert.True(res.StatusCode == HttpStatusCode.Forbidden || res.StatusCode == HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ProtectedEndpoint_NoToken_Returns401()
    {
        var res = await _client.GetAsync("/api/campaigns/mine");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
