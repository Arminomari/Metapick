namespace CreatorPay.Application.Interfaces;

/// <summary>
/// Outbound transactional email. Implementations must never throw — a failed
/// email may be logged but can never break the business flow that sent it.
/// </summary>
public interface IEmailService
{
    /// <summary>False when no provider is configured (emails are skipped).</summary>
    bool IsConfigured { get; }

    Task SendAsync(string to, string subject, string htmlBody);
}
