using CreatorPay.Application.Common;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Domain.Ugc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Application.Ugc.Services;

public interface IUgcCreatorService
{
    Task<Result<UgcCreatorProfileDto>> GetMineAsync(Guid userId, CancellationToken ct = default);
    Task<Result<UgcCreatorProfileDto>> UpsertMineAsync(Guid userId, UpsertUgcCreatorProfileRequest request, CancellationToken ct = default);
    Task<Result<UgcCreatorProfileDto>> RefreshVerificationAsync(Guid userId, CancellationToken ct = default);
    Task<Result<UgcPayoutOnboardingDto>> StartPayoutOnboardingAsync(Guid userId, CancellationToken ct = default);
    Task<Result<UgcPayoutOnboardingDto>> GetPayoutStatusAsync(Guid userId, CancellationToken ct = default);

    /// <summary>The marketplace row for a creator, created on first touch. Shared by the other services.</summary>
    Task<UgcCreatorProfile> GetOrCreateAsync(Guid creatorProfileId, CancellationToken ct = default);
}

/// <summary>
/// The creator's marketplace standing. Builds on the ordinary Vyrle creator
/// account: TikTok is already connected there, the portfolio already exists —
/// this layer adds the verification bar, the strikes and the payout account.
/// </summary>
public sealed class UgcCreatorService : IUgcCreatorService
{
    private readonly IRepository<CreatorProfile> _creators;
    private readonly IRepository<UgcCreatorProfile> _profiles;
    private readonly IRepository<PortfolioItem> _portfolio;
    private readonly IUnitOfWork _uow;
    private readonly ITikTokApiClient _tikTok;
    private readonly IEncryptionService _encryption;
    private readonly IUgcPaymentGateway _gateway;
    private readonly UgcSettings _settings;
    private readonly IConfiguration _config;
    private readonly ILogger<UgcCreatorService> _logger;

    public UgcCreatorService(IRepository<CreatorProfile> creators, IRepository<UgcCreatorProfile> profiles,
        IRepository<PortfolioItem> portfolio, IUnitOfWork uow, ITikTokApiClient tikTok, IEncryptionService encryption,
        IUgcPaymentGateway gateway, UgcSettings settings, IConfiguration config, ILogger<UgcCreatorService> logger)
    {
        _creators = creators; _profiles = profiles; _portfolio = portfolio; _uow = uow;
        _tikTok = tikTok; _encryption = encryption; _gateway = gateway; _settings = settings; _config = config; _logger = logger;
    }

    public async Task<UgcCreatorProfile> GetOrCreateAsync(Guid creatorProfileId, CancellationToken ct = default)
    {
        var p = await _profiles.Query().FirstOrDefaultAsync(x => x.CreatorProfileId == creatorProfileId, ct);
        if (p != null) return p;
        p = new UgcCreatorProfile { CreatorProfileId = creatorProfileId };
        _profiles.Add(p);
        await _uow.SaveChangesAsync(ct);
        return p;
    }

    public async Task<Result<UgcCreatorProfileDto>> GetMineAsync(Guid userId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var p = await GetOrCreateAsync(creator.Id, ct);
        return UgcMapper.CreatorProfile(creator, p, _settings);
    }

    public async Task<Result<UgcCreatorProfileDto>> UpsertMineAsync(Guid userId, UpsertUgcCreatorProfileRequest r, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var p = await GetOrCreateAsync(creator.Id, ct);

        if (r.Categories != null) p.Categories = UgcMapper.Clean(r.Categories).Take(6).ToArray();
        if (r.City != null) p.City = Trim(r.City, 100);
        if (r.Region != null) p.Region = Trim(r.Region, 100);
        if (r.Languages != null) p.Languages = UgcMapper.Clean(r.Languages).Take(5).ToArray() is { Length: > 0 } l ? l : ["sv"];
        if (r.SampleVideoUrl != null)
        {
            var url = r.SampleVideoUrl.Trim();
            var ok = url.Length == 0 || url.StartsWith("/uploads/", StringComparison.Ordinal)
                     || (Uri.TryCreate(url, UriKind.Absolute, out var u) && u.Scheme == "https");
            if (!ok) return Errors.Validation("Exempelvideon måste vara en https-länk (t.ex. din TikTok-video).");
            p.SampleVideoUrl = url.Length == 0 ? null : url;
        }
        if (r.HasFTax.HasValue) p.HasFTax = r.HasFTax.Value;
        if (r.VatRegistered.HasValue) p.VatRegistered = r.VatRegistered.Value;
        if (r.VatNumber != null) p.VatNumber = Trim(r.VatNumber, 40);
        if (r.AllowPortfolioUse.HasValue) p.AllowPortfolioUse = r.AllowPortfolioUse.Value;

        await _uow.SaveChangesAsync(ct);

        // A profile change may lift the creator over the bar — check right away.
        await EvaluateAsync(creator, p, ct);
        return UgcMapper.CreatorProfile(creator, p, _settings);
    }

    public async Task<Result<UgcCreatorProfileDto>> RefreshVerificationAsync(Guid userId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().Include(c => c.TikTokAccount).FirstOrDefaultAsync(c => c.UserId == userId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var p = await GetOrCreateAsync(creator.Id, ct);
        await EvaluateAsync(creator, p, ct);
        return UgcMapper.CreatorProfile(creator, p, _settings);
    }

    /// <summary>
    /// Snapshot followers and like/follower ratio from TikTok, then run the
    /// automatic filter. Never demotes an admin-approved creator; never
    /// touches a suspended one.
    /// </summary>
    private async Task EvaluateAsync(CreatorProfile creator, UgcCreatorProfile p, CancellationToken ct)
    {
        var tiktok = creator.TikTokAccount ?? await _creators.Query()
            .Where(c => c.Id == creator.Id).Select(c => c.TikTokAccount).FirstOrDefaultAsync(ct);

        var followers = Math.Max(creator.FollowerCount, tiktok?.FollowerCount ?? 0);
        var ratio = p.LikeFollowerRatio;

        if (tiktok is { IsActive: true } && tiktok.Scopes != "manual" && !string.IsNullOrEmpty(tiktok.AccessTokenEncrypted))
        {
            try
            {
                var token = _encryption.Decrypt(tiktok.AccessTokenEncrypted);
                var videos = await _tikTok.GetUserVideosAsync(token, DateTime.UtcNow.AddDays(-90), 50);
                if (videos.Count > 0)
                    ratio = UgcVerificationRule.LikeFollowerRatio(videos.Sum(v => v.LikeCount), followers);
            }
            catch (Exception ex)
            {
                _logger.LogInformation(ex, "UGC verification: TikTok videos unavailable for creator {Id}; keeping last ratio", creator.Id);
            }
        }

        var hasSample = !string.IsNullOrWhiteSpace(p.SampleVideoUrl)
            || await _portfolio.Query().AnyAsync(i => i.CreatorProfileId == creator.Id
                && (i.MediaType == PortfolioMediaType.Video || i.MediaType == PortfolioMediaType.TikTok), ct);

        p.FollowerSnapshot = followers;
        p.LikeFollowerRatio = ratio;
        p.SocialSnapshotAt = DateTime.UtcNow;
        p.Status = UgcVerificationRule.Evaluate(p.Status, followers, ratio, hasSample, _settings.Thresholds);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task<Result<UgcPayoutOnboardingDto>> StartPayoutOnboardingAsync(Guid userId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().Include(c => c.User).FirstOrDefaultAsync(c => c.UserId == userId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var p = await GetOrCreateAsync(creator.Id, ct);

        if (!_gateway.IsConfigured)
            return new UgcPayoutOnboardingDto(null, p.PayoutOnboardingComplete, p.StripeConnectAccountId, false, UnconfiguredUgcPaymentGateway.Message);

        var baseUrl = (_config["Frontend:BaseUrl"] ?? "https://www.vyrle.co").TrimEnd('/');
        var result = await _gateway.CreateConnectOnboardingAsync(creator.Id, p.StripeConnectAccountId, creator.User.Email,
            $"{baseUrl}/creator/ugc/profile?onboarding=done", $"{baseUrl}/creator/ugc/profile?onboarding=refresh", ct);
        if (!result.Success) return Errors.Conflict(result.Error ?? "Kunde inte starta registreringen.");

        p.StripeConnectAccountId = result.ExternalId;
        await _uow.SaveChangesAsync(ct);
        return new UgcPayoutOnboardingDto(result.Url, false, p.StripeConnectAccountId, true, null);
    }

    public async Task<Result<UgcPayoutOnboardingDto>> GetPayoutStatusAsync(Guid userId, CancellationToken ct = default)
    {
        var creator = await _creators.Query().FirstOrDefaultAsync(c => c.UserId == userId, ct);
        if (creator == null) return Errors.NotFound("Creator");
        var p = await GetOrCreateAsync(creator.Id, ct);

        if (string.IsNullOrEmpty(p.StripeConnectAccountId))
            return new UgcPayoutOnboardingDto(null, false, null, _gateway.IsConfigured, _gateway.IsConfigured ? null : UnconfiguredUgcPaymentGateway.Message);

        if (_gateway.IsConfigured)
        {
            var status = await _gateway.GetConnectStatusAsync(p.StripeConnectAccountId, ct);
            if (status.Ready != p.PayoutOnboardingComplete)
            {
                p.PayoutOnboardingComplete = status.Ready;
                await _uow.SaveChangesAsync(ct);
            }
            return new UgcPayoutOnboardingDto(null, p.PayoutOnboardingComplete, p.StripeConnectAccountId, true,
                status.Ready ? null : status.DisabledReason ?? "Registreringen är inte klar ännu.");
        }
        return new UgcPayoutOnboardingDto(null, p.PayoutOnboardingComplete, p.StripeConnectAccountId, false, UnconfiguredUgcPaymentGateway.Message);
    }

    private static string? Trim(string s, int max)
    {
        var t = s.Trim();
        return t.Length == 0 ? null : t.Length > max ? t[..max] : t;
    }
}
