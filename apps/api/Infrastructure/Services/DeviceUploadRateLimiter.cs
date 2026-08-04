using StackExchange.Redis;

namespace CertiWatch.Api.Infrastructure.Services;

public interface IDeviceUploadRateLimiter
{
    Task<bool> TryAcquireAsync(Guid deviceId, CancellationToken token);
}

// Caps how many files a single device can upload per minute, purely to blunt a misbehaving or
// compromised agent from hammering the ingestion pipeline - not a precision limiter. Fails open
// (allows the request) if Redis is unreachable: abuse prevention shouldn't take uploads down.
public sealed class DeviceUploadRateLimiter(IConnectionMultiplexer redis, ILogger<DeviceUploadRateLimiter> logger) : IDeviceUploadRateLimiter
{
    public const int MaxPerMinute = 30;

    public static bool IsWithinLimit(long countAfterIncrement) => countAfterIncrement <= MaxPerMinute;

    public async Task<bool> TryAcquireAsync(Guid deviceId, CancellationToken token)
    {
        try
        {
            var db = redis.GetDatabase();
            var bucket = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
            var key = $"rl:upload:{deviceId}:{bucket}";

            var count = await db.StringIncrementAsync(key);
            if (count == 1)
            {
                await db.KeyExpireAsync(key, TimeSpan.FromMinutes(2));
            }

            return IsWithinLimit(count);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Rate limiter unreachable; allowing upload for device {DeviceId}", deviceId);
            return true;
        }
    }
}
