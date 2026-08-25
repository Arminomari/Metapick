using CreatorPay.Application.Common;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Domain.Enums;
using CreatorPay.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Application.Services;

/// <summary>
/// Admin ↔ user conversation. An admin writes from the user table; the message
/// lands as an in-app notification, as a real email the user can read in their
/// inbox, and in a thread they answer with one click. The answer comes back to
/// every admin — same thread, nothing lost between approve and reject.
/// </summary>
public class SupportMessageService : ISupportMessageService
{
    private const string AppUrl = "https://www.vyrle.co";

    private readonly IRepository<SupportMessage> _messages;
    private readonly IRepository<User> _users;
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notify;
    private readonly IEmailService _email;
    private readonly IAuditService _audit;

    public SupportMessageService(
        IRepository<SupportMessage> messages,
        IRepository<User> users,
        IUnitOfWork uow,
        INotificationService notify,
        IEmailService email,
        IAuditService audit)
    {
        _messages = messages;
        _users = users;
        _uow = uow;
        _notify = notify;
        _email = email;
        _audit = audit;
    }

    // ── Admin side ─────────────────────────────────────────────────
    public async Task<Result<List<SupportMessageDto>>> GetThreadForAdminAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _users.Query().IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return Errors.NotFound("User", userId);

        var rows = await LoadThreadAsync(userId, ct);

        // Opening the thread is reading it: the user's replies stop being new.
        var unread = rows.Where(m => !m.FromAdmin && !m.IsRead).ToList();
        if (unread.Count > 0)
        {
            foreach (var m in unread) { m.IsRead = true; m.ReadAt = DateTime.UtcNow; }
            await _uow.SaveChangesAsync(ct);
        }

        return await MapAsync(rows, user, ct);
    }

    public async Task<Result<SupportMessageDto>> SendFromAdminAsync(
        Guid adminUserId, Guid userId, SendSupportMessageRequest request, CancellationToken ct = default)
    {
        var body = (request.Body ?? "").Trim();
        if (body.Length == 0) return Errors.Validation("Skriv ett meddelande först.");
        if (body.Length > 4000) return Errors.Validation("Meddelandet får vara högst 4000 tecken.");

        var user = await _users.Query().IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return Errors.NotFound("User", userId);
        if (user.Role == UserRole.Admin) return Errors.Validation("Admins har ingen supporttråd.");

        var row = new SupportMessage
        {
            UserId = userId,
            SenderId = adminUserId,
            FromAdmin = true,
            Body = body
        };
        _messages.Add(row);
        await _uow.SaveChangesAsync(ct);

        await _notify.SendAsync(userId, NotificationType.SystemMessage,
            "Du har ett nytt meddelande från VYRLE. Öppna Meddelanden för att svara.");

        if (request.SendEmail)
        {
            try
            {
                await _email.SendAsync(user.Email, "Meddelande från VYRLE",
                    EmailTemplates.Branded("Meddelande från VYRLE",
                        $"<p>Hej {System.Net.WebUtility.HtmlEncode(user.FirstName)}!</p>" +
                        $"<p>{System.Net.WebUtility.HtmlEncode(body).Replace("\n", "<br/>")}</p>" +
                        "<p style=\"color:#6E7480;font-size:13px\">Svara genom att klicka på knappen nedan — ditt svar går direkt till VYRLE:s team.</p>",
                        "Svara VYRLE", $"{AppUrl}/messages"));
            }
            catch
            {
                // the in-app message already landed; a dead mailbox must not
                // lose the admin's message
            }
        }

        await _audit.LogAsync(adminUserId, "Admin.MessageSent", "User", userId);
        return Map(row, "VYRLE");
    }

    public async Task<Result<List<SupportThreadDto>>> GetThreadsAsync(bool unreadOnly, CancellationToken ct = default)
    {
        var grouped = await _messages.Query()
            .GroupBy(m => m.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                LastAt = g.Max(m => m.CreatedAt),
                MessageCount = g.Count(),
                UnreadFromUser = g.Count(m => !m.FromAdmin && !m.IsRead)
            })
            .ToListAsync(ct);

        if (unreadOnly) grouped = grouped.Where(g => g.UnreadFromUser > 0).ToList();
        if (grouped.Count == 0) return new List<SupportThreadDto>();

        var userIds = grouped.Select(g => g.UserId).ToList();

        var lasts = await _messages.Query()
            .Where(m => userIds.Contains(m.UserId))
            .Select(m => new { m.UserId, m.Body, m.FromAdmin, m.CreatedAt })
            .ToListAsync(ct);
        var lastByUser = lasts
            .GroupBy(m => m.UserId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(m => m.CreatedAt).First());

        var users = await _users.Query().IgnoreQueryFilters()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new
            {
                u.Id, u.Email, u.Role, u.Status, u.FirstName, u.LastName,
                CreatorName = u.CreatorProfile != null ? u.CreatorProfile.DisplayName : null,
                BrandName = u.BrandProfile != null ? u.BrandProfile.CompanyName : null
            })
            .ToListAsync(ct);
        var userById = users.ToDictionary(u => u.Id);

        return grouped
            .Where(g => userById.ContainsKey(g.UserId) && lastByUser.ContainsKey(g.UserId))
            .Select(g =>
            {
                var u = userById[g.UserId];
                var last = lastByUser[g.UserId];
                var name = u.Role == UserRole.Brand
                    ? u.BrandName ?? $"{u.FirstName} {u.LastName}".Trim()
                    : u.CreatorName ?? $"{u.FirstName} {u.LastName}".Trim();
                return new SupportThreadDto(
                    g.UserId, string.IsNullOrWhiteSpace(name) ? u.Email : name, u.Email,
                    u.Role.ToString(), u.Status.ToString(),
                    last.Body, last.FromAdmin, g.LastAt, g.UnreadFromUser, g.MessageCount);
            })
            .OrderByDescending(x => x.UnreadFromUser > 0)
            .ThenByDescending(x => x.LastAt)
            .ToList();
    }

    // ── User side ──────────────────────────────────────────────────
    public async Task<Result<List<SupportMessageDto>>> GetMyThreadAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _users.Query().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return Errors.NotFound("User", userId);

        var rows = await LoadThreadAsync(userId, ct);

        var unread = rows.Where(m => m.FromAdmin && !m.IsRead).ToList();
        if (unread.Count > 0)
        {
            foreach (var m in unread) { m.IsRead = true; m.ReadAt = DateTime.UtcNow; }
            await _uow.SaveChangesAsync(ct);
        }

        return await MapAsync(rows, user, ct);
    }

    public async Task<Result<SupportMessageDto>> ReplyAsync(Guid userId, SendSupportMessageRequest request, CancellationToken ct = default)
    {
        var body = (request.Body ?? "").Trim();
        if (body.Length == 0) return Errors.Validation("Skriv ett meddelande först.");
        if (body.Length > 4000) return Errors.Validation("Meddelandet får vara högst 4000 tecken.");

        var user = await _users.Query().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return Errors.NotFound("User", userId);

        var row = new SupportMessage
        {
            UserId = userId,
            SenderId = userId,
            FromAdmin = false,
            Body = body
        };
        _messages.Add(row);
        await _uow.SaveChangesAsync(ct);

        // Every admin sees it — nobody has to be the one who opened the thread.
        var admins = await _users.Query()
            .Where(u => u.Role == UserRole.Admin && u.Status == UserStatus.Active)
            .Select(u => new { u.Id, u.Email })
            .ToListAsync(ct);

        var who = DisplayName(user);
        var preview = body.Length > 300 ? body[..300] + "…" : body;
        foreach (var admin in admins)
        {
            await _notify.SendAsync(admin.Id, NotificationType.SystemMessage,
                $"{who} svarade: {preview}", userId);
            try
            {
                await _email.SendAsync(admin.Email, $"Svar från {who}",
                    EmailTemplates.Branded($"Svar från {who}",
                        $"<p>{System.Net.WebUtility.HtmlEncode(body).Replace("\n", "<br/>")}</p>" +
                        $"<p style=\"color:#6E7480;font-size:13px\">{System.Net.WebUtility.HtmlEncode(user.Email)}</p>",
                        "Öppna adminpanelen", $"{AppUrl}/admin?section=users"));
            }
            catch
            {
                // the notification is the guarantee; mail is the convenience
            }
        }

        return Map(row, who);
    }

    public async Task<int> CountUnreadForUserAsync(Guid userId, CancellationToken ct = default)
        => await _messages.Query().CountAsync(m => m.UserId == userId && m.FromAdmin && !m.IsRead, ct);

    // ── Shared ─────────────────────────────────────────────────────
    private async Task<List<SupportMessage>> LoadThreadAsync(Guid userId, CancellationToken ct)
        => await _messages.Query()
            .Where(m => m.UserId == userId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);

    private async Task<List<SupportMessageDto>> MapAsync(List<SupportMessage> rows, User user, CancellationToken ct)
    {
        if (rows.Count == 0) return new List<SupportMessageDto>();
        var userName = DisplayName(user);
        await Task.CompletedTask;
        return rows.Select(m => Map(m, m.FromAdmin ? "VYRLE" : userName)).ToList();
    }

    private static SupportMessageDto Map(SupportMessage m, string senderName)
        => new(m.Id, m.Body, m.FromAdmin, senderName, m.IsRead, m.CreatedAt);

    private static string DisplayName(User u)
    {
        var name = $"{u.FirstName} {u.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? u.Email : name;
    }
}
