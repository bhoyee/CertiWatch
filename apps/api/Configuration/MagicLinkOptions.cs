namespace CertiWatch.Api.Configuration;

public sealed class MagicLinkOptions
{
    public string Secret { get; set; } = "local-secret";
    public string BaseUrl { get; set; } = "https://app.certiwatch.test";
    public int ExpiryMinutes { get; set; } = 60;
}
