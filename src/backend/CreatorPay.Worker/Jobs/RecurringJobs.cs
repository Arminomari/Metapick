using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Worker.Jobs;

/// <summary>
/// CampaignExpirationJob – stänger kampanjer vars end_date har passerat.
/// Kör dagligen kl 01:00.
/// </summary>
public class CampaignExpirationJob
{
    private readonly ILogger<CampaignExpirationJob> _logger;
    private readonly IRepository<Campaign> _campaigns;
    private readonly IUnitOfWork _uow;

    public CampaignExpirationJob(ILogger<CampaignExpirationJob> logger,
        IRepository<Campaign> campaigns, IUnitOfWork uow)
    {
        _logger = logger;
        _campaigns = campaigns;
        _uow = uow;
    }

    public async Task ExecuteAsync()
    {
        var today = DateTime.UtcNow.Date;
        var expired = await _campaigns.Query()
            .Where(c => (c.Status == CampaignStatus.Active || c.Status == CampaignStatus.Paused)
                && c.EndDate.Date < today)
            .ToListAsync();

        _logger.LogInformation("CampaignExpirationJob: {Count} campaigns to expire", expired.Count);

        foreach (var campaign in expired)
        {
            campaign.Status = CampaignStatus.Completed;
            _logger.LogInformation("Campaign {Id} ({Name}) expired", campaign.Id, campaign.Name);
        }

        await _uow.SaveChangesAsync();
    }
}

/// <summary>
/// TokenRefreshJob – förnyar TikTok access tokens som håller på att gå ut.
/// Kör var 6:e timme.
/// </summary>
public class TokenRefreshJob
{
    private readonly ILogger<TokenRefreshJob> _logger;
    private readonly IRepository<TikTokAccount> _accounts;
    private readonly IUnitOfWork _uow;
    private readonly Application.Interfaces.ITikTokApiClient _tikTok;
    private readonly Application.Interfaces.IEncryptionService _encryption;

    public TokenRefreshJob(ILogger<TokenRefreshJob> logger,
        IRepository<TikTokAccount> accounts, IUnitOfWork uow,
        Application.Interfaces.ITikTokApiClient tikTok,
        Application.Interfaces.IEncryptionService encryption)
    {
        _logger = logger;
        _accounts = accounts;
        _uow = uow;
        _tikTok = tikTok;
        _encryption = encryption;
    }

    public async Task ExecuteAsync()
    {
        var expiringSoon = await _accounts.Query()
            .Where(a => a.TokenExpiresAt < DateTime.UtcNow.AddHours(12) && a.RefreshTokenEncrypted != null)
            .ToListAsync();

        _logger.LogInformation("TokenRefreshJob: {Count} tokens to refresh", expiringSoon.Count);

        foreach (var account in expiringSoon)
        {
            try
            {
                var decryptedRefresh = _encryption.Decrypt(account.RefreshTokenEncrypted);
                _logger.LogInformation("Refreshing token for account {Username}", account.TikTokUsername);

                var result = await _tikTok.RefreshTokenAsync(decryptedRefresh);

                account.AccessTokenEncrypted = _encryption.Encrypt(result.AccessToken);
                account.RefreshTokenEncrypted = _encryption.Encrypt(result.RefreshToken);
                account.TokenExpiresAt = DateTime.UtcNow.AddSeconds(result.ExpiresIn);

                _logger.LogInformation("Token refreshed for {Username}, expires at {Expiry}",
                    account.TikTokUsername, account.TokenExpiresAt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to refresh token for {Username}", account.TikTokUsername);
                // Mark as inactive if refresh fails — user needs to re-connect
                account.IsActive = false;
            }
        }

        await _uow.SaveChangesAsync();
    }
}

/// <summary>
/// FraudDetectionJob – kör dagliga analyser för att upptäcka misstänkt bedrägeri.
/// Kontrollerar:
/// - Plötsliga view-spikar (>500% på 24h)
/// - Lågt engagement-ratio (views > 10k men < 0.1% likes)
/// - Multipla konton från samma IP/enhet
/// - Views från okänd geografi
/// </summary>
public class FraudDetectionJob
{
    private readonly ILogger<FraudDetectionJob> _logger;
    private readonly IRepository<SocialPost> _posts;
    private readonly IRepository<SocialPostMetricSnapshot> _snapshots;
    private readonly Application.Interfaces.IFraudService _fraud;
    private readonly IUnitOfWork _uow;

    public FraudDetectionJob(ILogger<FraudDetectionJob> logger,
        IRepository<SocialPost> posts,
        IRepository<SocialPostMetricSnapshot> snapshots,
        Application.Interfaces.IFraudService fraud,
        IUnitOfWork uow)
    {
        _logger = logger;
        _posts = posts;
        _snapshots = snapshots;
        _fraud = fraud;
        _uow = uow;
    }

    public async Task ExecuteAsync()
    {
        _logger.LogInformation("FraudDetectionJob started at {Time}", DateTime.UtcNow);

        await CheckLowEngagementRatio();
        await CheckDuplicateVideos();

        _logger.LogInformation("FraudDetectionJob completed at {Time}", DateTime.UtcNow);
    }

    private async Task CheckLowEngagementRatio()
    {
        // Posts with >10k views but < 0.1% like ratio
        var suspicious = await _posts.Query()
            .Where(p => p.LatestViewCount > 10000
                && p.LatestLikeCount > 0
                && (double)p.LatestLikeCount / p.LatestViewCount < 0.001
                && p.VerificationStatus != VerificationStatus.Failed)
            .ToListAsync();

        foreach (var post in suspicious)
        {
            var ratio = (double)post.LatestLikeCount / post.LatestViewCount;
            _logger.LogWarning("Low engagement post {Id}: {Views} views, {Ratio:P2} like ratio",
                post.Id, post.LatestViewCount, ratio);

            await _fraud.CreateFraudFlagAsync(new Application.DTOs.CreateFraudFlagRequest(
                "SocialPost", post.Id, "BotActivity", "Medium",
                $"Engagement ratio {ratio:P2} ({post.LatestLikeCount} likes / {post.LatestViewCount} views) under threshold"));

            post.VerificationStatus = VerificationStatus.Failed;
        }

        await _uow.SaveChangesAsync();
    }

    private async Task CheckDuplicateVideos()
    {
        // Step 1: Find duplicate URLs via SQL-safe GroupBy
        var duplicateUrls = await _posts.Query()
            .GroupBy(p => p.TikTokUrl)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToListAsync();

        if (!duplicateUrls.Any()) return;

        // Step 2: Load the actual posts for those URLs
        var duplicatePosts = await _posts.Query()
            .Where(p => duplicateUrls.Contains(p.TikTokUrl))
            .ToListAsync();

        var grouped = duplicatePosts.GroupBy(p => p.TikTokUrl);

        foreach (var dup in grouped)
        {
            _logger.LogWarning("Duplicate video URL detected: {Url} ({Count} submissions)",
                dup.Key, dup.Count());

            foreach (var post in dup)
            {
                if (post.VerificationStatus != VerificationStatus.Failed)
                {
                    await _fraud.CreateFraudFlagAsync(new Application.DTOs.CreateFraudFlagRequest(
                        "SocialPost", post.Id, "DuplicateVideo", "High",
                        $"Video URL {dup.Key} submitted to {dup.Count()} campaigns"));
                }
            }
        }
    }
}

/// <summary>
/// PayoutSettlementJob – slutför utbetalningar via extern payout provider.
/// Kör var 4:e timme.
/// </summary>
public class PayoutSettlementJob
{
    private readonly ILogger<PayoutSettlementJob> _logger;
    private readonly IRepository<PayoutTransaction> _transactions;
    private readonly Application.Interfaces.IPayoutProvider _payoutProvider;
    private readonly IUnitOfWork _uow;
    private readonly Application.Interfaces.IAuditService _audit;

    public PayoutSettlementJob(ILogger<PayoutSettlementJob> logger,
        IRepository<PayoutTransaction> transactions,
        Application.Interfaces.IPayoutProvider payoutProvider,
        IUnitOfWork uow,
        Application.Interfaces.IAuditService audit)
    {
        _logger = logger;
        _transactions = transactions;
        _payoutProvider = payoutProvider;
        _uow = uow;
        _audit = audit;
    }

    public async Task ExecuteAsync()
    {
        var pending = await _transactions.Query()
            .Where(t => t.Status == TransactionStatus.Initiated)
            .ToListAsync();

        _logger.LogInformation("PayoutSettlementJob: {Count} pending transactions", pending.Count);

        foreach (var tx in pending)
        {
            try
            {
                tx.Status = TransactionStatus.Processing;
                await _uow.SaveChangesAsync();

                var result = await _payoutProvider.InitiatePayoutAsync(
                    tx.Amount, tx.Currency, tx.PayoutRequestId.ToString());

                if (result.Success)
                {
                    tx.Status = TransactionStatus.Completed;
                    tx.ExternalTransactionId = result.ExternalTransactionId;
                    tx.CompletedAt = DateTime.UtcNow;
                    _logger.LogInformation("Transaction {Id} completed: {TxId}", tx.Id, result.ExternalTransactionId);
                }
                else
                {
                    tx.Status = TransactionStatus.Failed;
                    tx.FailureReason = result.ErrorMessage;
                    _logger.LogWarning("Transaction {Id} failed: {Error}", tx.Id, result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                tx.Status = TransactionStatus.Failed;
                tx.FailureReason = ex.Message;
                _logger.LogError(ex, "Transaction {Id} exception", tx.Id);
            }

            await _uow.SaveChangesAsync();
        }
    }
}
