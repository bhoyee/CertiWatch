namespace CertiWatch.Api.Configuration;

public sealed class EmailOptions
{
    public string ProviderApiKey { get; set; } = string.Empty;
    public string FromAddress { get; set; } = "noreply@certiwatch.app";
    public string FromName { get; set; } = "CertiWatch";
}
