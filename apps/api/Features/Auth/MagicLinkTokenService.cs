using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CertiWatch.Api.Features.Auth;

internal static class MagicLinkTokenService
{
    private sealed record Payload(string Email, Guid TenantId, long Exp, string Purpose, bool RememberDevice, string? DeviceId);

    public static string CreateToken(string email, Guid tenantId, string secret, TimeSpan lifetime, string purpose = "magic", bool rememberDevice = false, string? deviceId = null)
    {
        var payload = new Payload(email, tenantId, DateTimeOffset.UtcNow.Add(lifetime).ToUnixTimeSeconds(), purpose, rememberDevice, deviceId);
        var json = JsonSerializer.Serialize(payload);
        var data = Base64UrlEncode(Encoding.UTF8.GetBytes(json));
        var sig = Sign(data, secret);
        return $"{data}.{sig}";
    }

    public static (string Email, Guid TenantId, string Purpose, bool RememberDevice, string? DeviceId)? ValidateToken(string token, string secret)
    {
        var parts = token.Split('.');
        if (parts.Length != 2) return null;
        var data = parts[0];
        var sig = parts[1];
        if (!ConstantTimeEquals(Sign(data, secret), sig)) return null;
        var json = Encoding.UTF8.GetString(Base64UrlDecode(data));
        var payload = JsonSerializer.Deserialize<Payload>(json);
        if (payload is null) return null;
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > payload.Exp) return null;
        return (payload.Email, payload.TenantId, payload.Purpose, payload.RememberDevice, payload.DeviceId);
    }

    private static string Sign(string data, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Base64UrlEncode(hash);
    }

    private static bool ConstantTimeEquals(string a, string b)
    {
        var ba = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        if (ba.Length != bb.Length) return false;
        var diff = 0;
        for (var i = 0; i < ba.Length; i++) diff |= ba[i] ^ bb[i];
        return diff == 0;
    }

    private static string Base64UrlEncode(byte[] input)
    {
        var base64 = Convert.ToBase64String(input);
        return base64.Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace("-", "+").Replace("_", "/");
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
