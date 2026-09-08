namespace CreatorPay.Application.Ugc;

/// <summary>Where a stored file ended up.</summary>
public sealed record UgcStoredFile(string Key, long SizeBytes, string ContentType);

/// <summary>
/// Video deliverables need real object storage; the platform's default
/// <c>IFileStorageService</c> writes to local disk. This abstraction lets the
/// marketplace run on disk today (dev, first tests) and on S3/R2 the moment
/// the keys exist — the deliverable row stores a key, never a URL.
/// </summary>
public interface IUgcFileStore
{
    /// <summary>True when files live in cloud object storage rather than on the API host's disk.</summary>
    bool IsCloud { get; }

    /// <summary>Store a file under a key derived from the collab and version. Enforces size and type limits.</summary>
    Task<UgcStoredFile> SaveAsync(Stream content, string fileName, string contentType, Guid collabId, int version, CancellationToken ct = default);

    /// <summary>A URL the viewer can open now. Presigned and short-lived on cloud storage; a static path on disk.</summary>
    Task<string> GetUrlAsync(string key, CancellationToken ct = default);

    Task DeleteAsync(string key, CancellationToken ct = default);
}

/// <summary>Limits shared by every store implementation.</summary>
public static class UgcFileRules
{
    public const long MaxVideoBytes = 500L * 1024 * 1024;

    public static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "video/mp4", "video/quicktime", "video/webm", "video/x-m4v",
    };

    public static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mov", ".webm", ".m4v",
    };

    /// <summary>Null when fine, otherwise the reason in Swedish.</summary>
    public static string? Validate(long sizeBytes, string fileName, string contentType)
    {
        if (sizeBytes <= 0) return "Filen är tom.";
        if (sizeBytes > MaxVideoBytes) return $"Filen är för stor — max {MaxVideoBytes / 1024 / 1024} MB.";
        var ext = Path.GetExtension(fileName);
        if (!AllowedExtensions.Contains(ext)) return "Bara video (mp4, mov, webm, m4v) kan lämnas in.";
        if (!string.IsNullOrEmpty(contentType) && !AllowedContentTypes.Contains(contentType) && !contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase))
            return "Filen ser inte ut som en video.";
        return null;
    }
}
