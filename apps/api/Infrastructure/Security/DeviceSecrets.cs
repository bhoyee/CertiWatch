using System.Security.Cryptography;
using System.Text;

namespace CertiWatch.Api.Infrastructure.Security;

// Shared helpers for anything comparing/generating device-facing secrets: enrollment codes and
// device tokens. Centralized so every check uses a constant-time comparison rather than the
// timing-attack-prone `string.Equals` some of these endpoints used previously.
public static class DeviceSecrets
{
    public static string GenerateEnrollmentCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(15);
        return Convert.ToBase64String(bytes)
            .Replace("+", "")
            .Replace("/", "")
            .Replace("=", "")
            .ToUpperInvariant();
    }

    public static string Hash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static bool ConstantTimeEquals(string? a, string? b)
    {
        if (a is null || b is null)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
    }
}
