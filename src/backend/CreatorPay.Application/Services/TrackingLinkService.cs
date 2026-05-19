using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace CreatorPay.Application.Services;

public class TrackingLinkService : ITrackingLinkService
{
    private readonly IUnitOfWork _uow;
    private readonly IRepository<CreatorCampaignAssignment> _assignments;
    private readonly IRepository<TrackingLink> _links;
    private readonly IRepository<LinkTrackingClick> _clicks;

    public TrackingLinkService(
        IUnitOfWork uow,
        IRepository<CreatorCampaignAssignment> assignments,
        IRepository<TrackingLink> links,
        IRepository<LinkTrackingClick> clicks)
    {
        _uow = uow;
        _assignments = assignments;
        _links = links;
        _clicks = clicks;
    }

    public async Task<Result<TrackingLinkDto>> CreateLinkAsync(Guid assignmentId, Guid brandUserId, CreateTrackingLinkRequest request, CancellationToken ct = default)
    {
        if (!Uri.TryCreate(request.TargetUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return Errors.Validation("TargetUrl must be a valid http/https URL");

        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);
        if (assignment.Campaign.BrandProfile.UserId != brandUserId)
            return Errors.Forbidden("You do not have access to create links for this assignment");

        string? code;
        try
        {
            code = await ResolveUniqueCodeAsync(request.PreferredCode, ct);
        }
        catch (ArgumentException ex)
        {
            return Errors.Validation(ex.Message);
        }
        if (code == null)
            return Errors.Conflict("Unable to generate a unique tracking code");

        var link = new TrackingLink
        {
            AssignmentId = assignment.Id,
            CampaignId = assignment.CampaignId,
            CreatorProfileId = assignment.CreatorProfileId,
            Code = code,
            TargetUrl = request.TargetUrl,
            Label = request.Label,
            IsActive = true
        };

        _links.Add(link);
        await _uow.SaveChangesAsync(ct);

        return MapLink(link);
    }

    public async Task<Result<List<TrackingLinkDto>>> GetAssignmentLinksAsync(Guid assignmentId, Guid userId, CancellationToken ct = default)
    {
        var assignment = await _assignments.Query()
            .Include(a => a.Campaign).ThenInclude(c => c.BrandProfile)
            .Include(a => a.CreatorProfile)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct);

        if (assignment == null) return Errors.NotFound("Assignment", assignmentId);

        var isBrandOwner = assignment.Campaign.BrandProfile.UserId == userId;
        var isCreatorOwner = assignment.CreatorProfile.UserId == userId;
        if (!isBrandOwner && !isCreatorOwner)
            return Errors.Forbidden("You do not have access to these tracking links");

        var links = await _links.Query()
            .Where(l => l.AssignmentId == assignmentId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(ct);

        return links.Select(MapLink).ToList();
    }

    public async Task<Result<LinkRedirectResult>> RegisterClickAsync(string code, LinkClickContext context, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Errors.Validation("Code is required");

        var normalized = code.Trim().ToUpperInvariant();
        var link = await _links.Query().FirstOrDefaultAsync(l => l.Code == normalized && l.IsActive, ct);
        if (link == null) return Errors.NotFound("TrackingLink");

        link.TotalClicks += 1;

        _clicks.Add(new LinkTrackingClick
        {
            TrackingLinkId = link.Id,
            ClickedAt = DateTime.UtcNow,
            Referrer = context.Referrer,
            UserAgent = context.UserAgent,
            IpHash = context.IpHash
        });

        await _uow.SaveChangesAsync(ct);
        return new LinkRedirectResult(link.TargetUrl);
    }

    private async Task<string?> ResolveUniqueCodeAsync(string? preferredCode, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(preferredCode))
        {
            var normalizedPreferred = NormalizeCode(preferredCode);
            var preferredExists = await _links.Query().AnyAsync(l => l.Code == normalizedPreferred, ct);
            if (!preferredExists) return normalizedPreferred;
        }

        for (var i = 0; i < 6; i++)
        {
            var code = GenerateCode();
            var exists = await _links.Query().AnyAsync(l => l.Code == code, ct);
            if (!exists) return code;
        }

        return null;
    }

    private static string GenerateCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        Span<byte> bytes = stackalloc byte[8];
        RandomNumberGenerator.Fill(bytes);
        var sb = new StringBuilder(8);
        for (var i = 0; i < bytes.Length; i++)
            sb.Append(alphabet[bytes[i] % alphabet.Length]);
        return sb.ToString();
    }

    private static string NormalizeCode(string value)
    {
        var cleaned = new string(value.Where(char.IsLetterOrDigit).ToArray());
        if (string.IsNullOrWhiteSpace(cleaned))
            throw new ArgumentException("PreferredCode must include letters or numbers", nameof(value));
        return cleaned.ToUpperInvariant();
    }

    private static TrackingLinkDto MapLink(TrackingLink link) =>
        new(link.Id, link.AssignmentId, link.CampaignId, link.CreatorProfileId, link.Code,
            link.TargetUrl, link.Label, link.TotalClicks, link.IsActive, link.CreatedAt);

    public static string HashIp(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip)) return string.Empty;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(ip));
        return Convert.ToHexString(bytes);
    }
}
