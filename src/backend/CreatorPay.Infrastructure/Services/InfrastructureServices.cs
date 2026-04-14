using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using CreatorPay.Domain.Entities;
using CreatorPay.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// JWT token service that persists hashed refresh tokens to the User entity.
/// Access tokens are short-lived (15 min default); refresh tokens are 7 days.
/// </summary>
public class JwtTokenService : ITokenService
{
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;

    public JwtTokenService(IConfiguration config, AppDbContext db)
    {
        _config = config;
        _db = db;
    }

    public async Task<AuthResponse> GenerateTokensAsync(User user)
    {
        var accessToken = BuildAccessToken(user, out var expiresAt);
        var refreshToken = GenerateRefreshToken();

        // Persist hashed refresh token to database
        user.RefreshTokenHash = HashToken(refreshToken);
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        await _db.SaveChangesAsync();

        return new AuthResponse(accessToken, refreshToken, expiresAt,
            user.Id, user.Email, user.Role.ToString());
    }

    public async Task<AuthResponse?> RefreshAsync(string refreshToken)
    {
        var tokenHash = HashToken(refreshToken);
        var user = await _db.Users
            .FirstOrDefaultAsync(u =>
                u.RefreshTokenHash == tokenHash &&
                u.RefreshTokenExpiry > DateTime.UtcNow &&
                !u.IsDeleted);

        if (user == null) return null;

        var accessToken = BuildAccessToken(user, out var expiresAt);
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshTokenHash = HashToken(newRefreshToken);
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        await _db.SaveChangesAsync();

        return new AuthResponse(accessToken, newRefreshToken, expiresAt,
            user.Id, user.Email, user.Role.ToString());
    }

    public async Task RevokeAllTokensAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return;
        user.RefreshTokenHash = null;
        user.RefreshTokenExpiry = null;
        await _db.SaveChangesAsync();
    }

    private string BuildAccessToken(User user, out DateTime expiresAt)
    {
        var secret = _config["Jwt:Secret"]
            ?? throw new InvalidOperationException("JWT secret not configured");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        expiresAt = DateTime.UtcNow.AddMinutes(
            int.TryParse(_config["Jwt:ExpiryMinutes"], out var mins) ? mins : 15);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    }

    /// <summary>SHA-256 hash of the refresh token stored in DB (never store raw tokens).</summary>
    private static string HashToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash);
    }
}

public class EncryptionService : IEncryptionService
{
    /// <summary>
    /// 32-byte key read from configuration ("Encryption:Key", base-64 encoded).
    /// Falls back to a deterministic dev key when the setting is missing.
    /// In production ALWAYS set Encryption:Key to a random 32-byte, base-64 value.
    /// </summary>
    private readonly byte[] _key;

    public EncryptionService(IConfiguration config)
    {
        var b64 = config["Encryption:Key"];
        if (!string.IsNullOrWhiteSpace(b64))
        {
            _key = Convert.FromBase64String(b64);
            if (_key.Length != 32)
                throw new InvalidOperationException("Encryption:Key must be a 32-byte value (base-64 encoded).");
        }
        else
        {
            // Dev-only fallback – never use in production
            _key = Encoding.UTF8.GetBytes("MetaPick_DevKey_32BytesExact!!!!").Take(32).ToArray();
        }
    }

    public string HashPassword(string password)
        => BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);

    public bool VerifyPassword(string password, string hash)
        => BCrypt.Net.BCrypt.Verify(password, hash);

    /// <summary>AES-256-CBC with a random 16-byte IV prepended to the ciphertext.</summary>
    public string Encrypt(string plainText)
    {
        using var aes = Aes.Create();
        aes.Key = _key;
        aes.GenerateIV();

        using var ms = new MemoryStream();
        ms.Write(aes.IV, 0, aes.IV.Length);

        using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
        using (var sw = new StreamWriter(cs))
            sw.Write(plainText);

        return Convert.ToBase64String(ms.ToArray());
    }

    public string Decrypt(string cipherText)
    {
        var data = Convert.FromBase64String(cipherText);

        using var aes = Aes.Create();
        aes.Key = _key;

        var iv = new byte[16];
        Array.Copy(data, 0, iv, 0, 16);
        aes.IV = iv;

        using var ms = new MemoryStream(data, 16, data.Length - 16);
        using var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read);
        using var sr = new StreamReader(cs);
        return sr.ReadToEnd();
    }
}

public class FileStorageService : IFileStorageService
{
    /// <summary>Allowed upload extensions – covers images and short videos only.</summary>
    private static readonly HashSet<string> AllowedExtensions =
        [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov"];

    /// <summary>100 MB hard cap per upload.</summary>
    private const long MaxFileSizeBytes = 100L * 1024 * 1024;

    private readonly string _basePath;
    private readonly ILogger<FileStorageService> _logger;

    public FileStorageService(IConfiguration config, IHostEnvironment env, ILogger<FileStorageService> logger)
    {
        _basePath = config["Storage:BasePath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        _logger = logger;
        Directory.CreateDirectory(_basePath);

        if (env.IsProduction())
        {
            // Not an exception — app still starts, but ops will see this immediately
            _logger.LogCritical(
                "FileStorageService is using LOCAL DISK storage in PRODUCTION. " +
                "This will NOT work across multiple instances or container restarts. " +
                "Configure a cloud storage provider (e.g. Azure Blob Storage or S3) before going live.");
        }
    }

    public async Task<string> UploadAsync(Stream stream, string fileName, string contentType)
    {
        if (stream.Length > MaxFileSizeBytes)
            throw new InvalidOperationException(
                $"File exceeds the maximum allowed size of {MaxFileSizeBytes / 1024 / 1024} MB.");

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new InvalidOperationException(
                $"File type '{ext}' is not permitted. Allowed types: {string.Join(", ", AllowedExtensions)}");

        // GUID filename eliminates any path-traversal or filename-injection risk
        var safeFileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(_basePath, safeFileName);

        await using var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None);
        await stream.CopyToAsync(fs);

        _logger.LogInformation("Uploaded file {FileName} ({Bytes} bytes)", safeFileName, stream.Length);
        return $"/uploads/{safeFileName}";
    }

    public Task<bool> DeleteAsync(string path)
    {
        // Strip any directory component to prevent traversal attacks
        var safeFileName = Path.GetFileName(path);
        var filePath = Path.Combine(_basePath, safeFileName);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }
}
