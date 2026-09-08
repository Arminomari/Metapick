using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using CreatorPay.Application.Ugc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CreatorPay.Infrastructure.Services;

/// <summary>
/// Local disk under {Storage:BasePath}/ugc, served at /uploads/ugc/… — for
/// development and the first live tests. Files here do not survive a
/// container restart on Railway; the S3 store replaces this in production.
/// </summary>
public sealed class LocalUgcFileStore : IUgcFileStore
{
    private readonly string _root;
    private readonly ILogger<LocalUgcFileStore> _logger;

    public LocalUgcFileStore(IConfiguration config, ILogger<LocalUgcFileStore> logger)
    {
        var basePath = config["Storage:BasePath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        _root = Path.Combine(basePath, "ugc");
        Directory.CreateDirectory(_root);
        _logger = logger;
    }

    public bool IsCloud => false;

    public async Task<UgcStoredFile> SaveAsync(Stream content, string fileName, string contentType, Guid collabId, int version, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var key = $"{collabId:N}-v{version}-{Guid.NewGuid():N}{ext}";
        var path = Path.Combine(_root, key);
        await using var fs = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(fs, ct);
        _logger.LogInformation("UGC file stored locally: {Key} ({Bytes} bytes)", key, fs.Length);
        return new UgcStoredFile(key, fs.Length, string.IsNullOrEmpty(contentType) ? "video/mp4" : contentType);
    }

    public Task<string> GetUrlAsync(string key, CancellationToken ct = default)
        => Task.FromResult($"/uploads/ugc/{Path.GetFileName(key)}");

    public Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var path = Path.Combine(_root, Path.GetFileName(key));
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }
}

/// <summary>
/// S3-compatible object storage — AWS S3, Cloudflare R2, MinIO. Private
/// bucket; viewers get one-hour presigned URLs. Activated when
/// Storage:S3:Bucket and the two keys are set.
/// </summary>
public sealed class S3UgcFileStore : IUgcFileStore
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;
    private readonly string? _publicBaseUrl;
    private readonly ILogger<S3UgcFileStore> _logger;

    public S3UgcFileStore(IConfiguration config, ILogger<S3UgcFileStore> logger)
    {
        _bucket = config["Storage:S3:Bucket"]!;
        _publicBaseUrl = config["Storage:S3:PublicBaseUrl"]?.TrimEnd('/');
        _logger = logger;

        var s3Config = new AmazonS3Config
        {
            ForcePathStyle = true,
            // R2 and MinIO do not implement the newer checksum headers.
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
        };
        var serviceUrl = config["Storage:S3:ServiceUrl"];
        if (!string.IsNullOrEmpty(serviceUrl)) s3Config.ServiceURL = serviceUrl;
        var region = config["Storage:S3:Region"];
        if (!string.IsNullOrEmpty(region))
        {
            if (string.IsNullOrEmpty(serviceUrl)) s3Config.RegionEndpoint = RegionEndpoint.GetBySystemName(region);
            else s3Config.AuthenticationRegion = region;
        }
        else if (!string.IsNullOrEmpty(serviceUrl))
        {
            s3Config.AuthenticationRegion = "auto";
        }

        _s3 = new AmazonS3Client(new BasicAWSCredentials(config["Storage:S3:AccessKey"], config["Storage:S3:SecretKey"]), s3Config);
    }

    public bool IsCloud => true;

    public async Task<UgcStoredFile> SaveAsync(Stream content, string fileName, string contentType, Guid collabId, int version, CancellationToken ct = default)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var key = $"ugc/{collabId:N}/v{version}-{Guid.NewGuid():N}{ext}";
        var type = string.IsNullOrEmpty(contentType) ? "video/mp4" : contentType;

        var request = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = type,
            AutoCloseStream = false,
            DisablePayloadSigning = true,
        };
        await _s3.PutObjectAsync(request, ct);
        var size = content.CanSeek ? content.Length : 0;
        _logger.LogInformation("UGC file stored in S3: {Key} ({Bytes} bytes)", key, size);
        return new UgcStoredFile(key, size, type);
    }

    public Task<string> GetUrlAsync(string key, CancellationToken ct = default)
    {
        if (!string.IsNullOrEmpty(_publicBaseUrl)) return Task.FromResult($"{_publicBaseUrl}/{key}");
        var url = _s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _bucket,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.AddHours(1),
        });
        return Task.FromResult(url);
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
        => _s3.DeleteObjectAsync(_bucket, key, ct);
}
