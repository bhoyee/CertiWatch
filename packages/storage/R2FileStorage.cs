using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace CertiWatch.Storage;

// Cloudflare R2 is S3-compatible, so the plain AWS SDK works against it with a custom
// ServiceURL - no R2-specific SDK needed. R2 doesn't have AWS-style regions, but the SDK still
// requires one to be set for request signing; "auto" is what Cloudflare's own docs use.
public sealed class R2FileStorage : IFileStorage
{
    private readonly IAmazonS3 _client;
    private readonly string _bucket;

    public R2FileStorage(IOptions<StorageOptions> options)
    {
        var r2 = options.Value.R2;
        _bucket = r2.BucketName;
        var config = new AmazonS3Config
        {
            ServiceURL = $"https://{r2.AccountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true,
            AuthenticationRegion = "auto"
        };
        _client = new AmazonS3Client(r2.AccessKeyId, r2.SecretAccessKey, config);
    }

    public async Task SaveAsync(string key, Stream content, string? contentType, CancellationToken token)
    {
        await _client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType ?? "application/octet-stream",
            AutoCloseStream = false,
            DisablePayloadSigning = true // large PDFs stream faster without SigV4 chunked signing
        }, token);
    }

    public async Task<Stream> OpenReadAsync(string key, CancellationToken token)
    {
        var response = await _client.GetObjectAsync(_bucket, key, token);
        return response.ResponseStream;
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken token)
    {
        try
        {
            await _client.GetObjectMetadataAsync(_bucket, key, token);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    public async Task DeleteAsync(string key, CancellationToken token)
    {
        try
        {
            await _client.DeleteObjectAsync(_bucket, key, token);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            // Already gone - deleting a nonexistent key is a no-op, matching the Disk provider's
            // File.Exists-guarded delete.
        }
    }
}
