using System.Security.Cryptography;
using System.Text;
using CertiWatch.Api.Configuration;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Services;

public interface IMagicLinkService
{
    string CreateLink(Guid tenantId, Guid recordId, string action);
    MagicLinkResponse Validate(MagicLinkRequest request);
}

public sealed class MagicLinkService(IOptions<MagicLinkOptions> options, IDateTimeProvider clock) : IMagicLinkService
{
    private readonly MagicLinkOptions _options = options.Value;
    private readonly IDateTimeProvider _clock = clock;

    public string CreateLink(Guid tenantId, Guid recordId, string action)
    {
        var expires = _clock.UtcNow.AddMinutes(_options.ExpiryMinutes);
        var payload = $"{tenantId}|{recordId}|{action}|{expires:O}";
        var token = Sign(payload);
        var encoded = Uri.EscapeDataString(Convert.ToBase64String(Encoding.UTF8.GetBytes(payload)));
        return $"{_options.BaseUrl}/magic?action={action}&token={token}&payload={encoded}";
    }

    public MagicLinkResponse Validate(MagicLinkRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return new MagicLinkResponse(false, Message: "Missing token");
        }

        try
        {
            var bytes = Convert.FromBase64String(Uri.UnescapeDataString(request.Payload));
            var payload = Encoding.UTF8.GetString(bytes);
            var expectedSignature = Sign(payload);
            if (!CryptographicOperations.FixedTimeEquals(Convert.FromBase64String(request.Token), Convert.FromBase64String(expectedSignature)))
            {
                return new MagicLinkResponse(false, Message: "Invalid signature");
            }

            var segments = payload.Split('|');
            if (segments.Length < 4)
            {
                return new MagicLinkResponse(false, Message: "Invalid payload");
            }

            if (!DateTime.TryParse(segments[3], out var expires) || expires < _clock.UtcNow)
            {
                return new MagicLinkResponse(false, Message: "Link expired");
            }

            return new MagicLinkResponse(true, Message: "Link accepted");
        }
        catch
        {
            return new MagicLinkResponse(false, Message: "Malformed magic link");
        }
    }

    private string Sign(string payload)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.Secret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }
}
