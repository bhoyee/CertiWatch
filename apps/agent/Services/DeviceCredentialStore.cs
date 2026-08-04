using System.Text.Json;

namespace CertiWatch.Agent.Services;

public sealed record DeviceCredentials(Guid DeviceId, string DeviceToken);

public interface IDeviceCredentialStore
{
    Task<DeviceCredentials?> LoadAsync(CancellationToken token);
    Task SaveAsync(DeviceCredentials credentials, CancellationToken token);
}

// Persists the device identity issued at enrollment, across agent restarts - without this, a
// long-running installed service would call EnrollAsync again on every restart, which breaks
// once the enrollment code expires/is revoked (24h, or as soon as a new code is minted) and, even
// within that window, silently creates a new Device row server-side each time, abandoning the
// previous one's history. Enrollment only ever needs to happen once per install.
public sealed class DeviceCredentialStore : IDeviceCredentialStore
{
    private readonly string _storePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public DeviceCredentialStore(string storePath)
    {
        _storePath = storePath;
        var dir = Path.GetDirectoryName(storePath);
        if (!string.IsNullOrWhiteSpace(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }
    }

    public async Task<DeviceCredentials?> LoadAsync(CancellationToken token)
    {
        await _lock.WaitAsync(token);
        try
        {
            if (!File.Exists(_storePath))
            {
                return null;
            }

            await using var stream = File.OpenRead(_storePath);
            var credentials = await JsonSerializer.DeserializeAsync<DeviceCredentials>(stream, cancellationToken: token);
            if (credentials is null || credentials.DeviceId == Guid.Empty || string.IsNullOrWhiteSpace(credentials.DeviceToken))
            {
                return null;
            }

            return credentials;
        }
        catch
        {
            return null;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task SaveAsync(DeviceCredentials credentials, CancellationToken token)
    {
        await _lock.WaitAsync(token);
        try
        {
            await using var stream = File.Create(_storePath);
            await JsonSerializer.SerializeAsync(stream, credentials, new JsonSerializerOptions { WriteIndented = true }, token);
        }
        finally
        {
            _lock.Release();
        }
    }
}
