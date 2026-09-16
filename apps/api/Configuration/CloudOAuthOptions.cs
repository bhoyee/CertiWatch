namespace CertiWatch.Api.Configuration;

// Credentials for CertiWatch's own OAuth app registration in Google Cloud Console - not a
// per-tenant value. Every tenant that connects Google Drive goes through this one app; what's
// tenant-specific is the refresh token each tenant's consent produces, stored on their Source.
public sealed class GoogleOAuthOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}

// Same idea for the Azure AD app registration backing Microsoft OneDrive/SharePoint.
public sealed class MicrosoftOAuthOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
}
