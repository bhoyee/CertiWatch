namespace CertiWatch.Api.Configuration;

/// <summary>
/// Represents the email configuration options for the CertiWatch application.
/// This class contains all necessary settings for sending emails through various providers.
/// </summary>
public sealed class EmailOptions
{
    public string ProviderApiKey { get; set; } = string.Empty;
    public string FromAddress { get; set; } = "noreply@certiwatch.app";
    public string FromName { get; set; } = "CertiWatch";
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string SmtpUsername { get; set; } = string.Empty;
    public string SmtpPassword { get; set; } = string.Empty;
    public string SmtpEncryption { get; set; } = "starttls"; // ssl | starttls | none
}
