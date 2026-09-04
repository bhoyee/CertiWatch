namespace CertiWatch.Api.Configuration;

public sealed class MagicLinkOptions
{
    // No default on purpose: Program.cs refuses to start outside Development if this is
    // left empty or set to a known placeholder, so a real value must always be configured
    // explicitly (MagicLinks__Secret) for anything other than local dev.
    public string Secret { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "http://localhost:3300";
    public int ExpiryMinutes { get; set; } = 60; // magic-link validity
    public int LongSessionDays { get; set; } = 30; // remember-device session
    public int ShortSessionHours { get; set; } = 12; // non-remember session
}
