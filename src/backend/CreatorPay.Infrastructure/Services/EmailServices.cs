using System.Net.Http.Json;
using CreatorPay.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// Resend (resend.com) transactional email. Activated when Email:ResendApiKey
/// (env Email__ResendApiKey) is configured; requires the sending domain to be
/// verified at Resend. Never throws — email failure must not break flows.
/// </summary>
public class ResendEmailService : IEmailService
{
    private readonly HttpClient _http;
    private readonly ILogger<ResendEmailService> _logger;
    private readonly string _from;

    public ResendEmailService(HttpClient http, IConfiguration config, ILogger<ResendEmailService> logger)
    {
        _http = http;
        _logger = logger;
        _http.BaseAddress = new Uri("https://api.resend.com/");
        _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {config["Email:ResendApiKey"]}");
        _from = config["Email:From"] ?? "VYRLE <no-reply@vyrle.co>";
    }

    public bool IsConfigured => true;

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        try
        {
            var response = await _http.PostAsJsonAsync("emails", new
            {
                from = _from,
                to = new[] { to },
                subject,
                html = htmlBody
            });

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogError("Resend rejected email to {To} ({Status}): {Body}", to, (int)response.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To}", to);
        }
    }
}

/// <summary>Fallback when no email provider is configured: log and skip.</summary>
public class NullEmailService : IEmailService
{
    private readonly ILogger<NullEmailService> _logger;

    public NullEmailService(ILogger<NullEmailService> logger) => _logger = logger;

    public bool IsConfigured => false;

    public Task SendAsync(string to, string subject, string htmlBody)
    {
        _logger.LogInformation("Email skipped (no provider configured): \"{Subject}\" to {To}", subject, to);
        return Task.CompletedTask;
    }
}
