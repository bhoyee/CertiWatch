using System.Net.Http.Json;
using System.Text.Json;
using CertiWatch.Api.Configuration;
using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Features.Sources;

// Google Drive and Microsoft OneDrive connect through real OAuth instead of the tenant pasting a
// static secret key into a form (see the removed S3/GCS/Azure/Dropbox/WebDAV providers) - the
// tenant's admin is redirected to Google/Microsoft's own consent screen, grants access, and we
// only ever receive a scoped, revocable token back. Neither provider can be connected by posting
// to /api/sources directly; a Source for either only ever comes from finishing this flow.
//
// The Google scope is deliberately drive.file, not drive.readonly. drive.readonly is one of
// Google's "restricted" scopes - publishing an app that requests it past the 100-test-user cap
// requires an annual third-party CASA security assessment (paid, typically weeks, often
// four-figures - a real blocker for a bootstrapped app). drive.file only ever grants access to
// items the user explicitly picks (via the Google Picker on the frontend - see sources/page.tsx),
// never blanket access to their whole Drive. That's not a restricted scope, so verification to
// leave testing mode is Google's own review only - free, and no security assessment. It's also a
// better privacy story for a compliance product: "only the folder you chose", not "everything in
// your Drive".
public static class SourceOAuthEndpoints
{
    private const string GoogleStateCookie = "oauth_state_google";
    private const string MicrosoftStateCookie = "oauth_state_microsoft";
    private static readonly string[] GoogleScopes = ["https://www.googleapis.com/auth/drive.file"];
    private const string MicrosoftScope = "Files.Read.All offline_access";

    // One shared static client for these infrequent token-exchange calls - same reasoning as
    // BillingEndpoints.InvoicePdfClient: avoids socket exhaustion from a fresh HttpClient per call
    // without needing a full IHttpClientFactory registration (which isn't set up in this API, and
    // minimal API mis-infers an unregistered IHttpClientFactory parameter as a JSON body instead
    // of a service, breaking route binding at startup).
    private static readonly HttpClient OAuthHttpClient = new();

    public static IEndpointRouteBuilder MapSourceOAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/sources/oauth").RequireAuthorization();
        group.MapGet("/google/start", StartGoogleAsync);
        group.MapGet("/google/callback", GoogleCallbackAsync);
        group.MapGet("/microsoft/start", StartMicrosoftAsync);
        group.MapGet("/microsoft/callback", MicrosoftCallbackAsync);
        return group;
    }

    private static IResult StartGoogleAsync(
        HttpContext httpContext,
        ITenantContextAccessor tenantAccessor,
        IOptions<GoogleOAuthOptions> googleOptions,
        ILoggerFactory loggerFactory)
    {
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        var options = googleOptions.Value;
        if (string.IsNullOrWhiteSpace(options.ClientId) || string.IsNullOrWhiteSpace(options.RedirectUri))
        {
            loggerFactory.CreateLogger("SourceOAuth").LogWarning("Google OAuth is not configured (GoogleOAuth:ClientId/RedirectUri missing)");
            return Results.Problem("Google Drive isn't configured on this server yet.", statusCode: 503);
        }

        var state = Guid.NewGuid().ToString("N");
        httpContext.Response.Cookies.Append(GoogleStateCookie, state, StateCookieOptions());

        var query = new Dictionary<string, string?>
        {
            ["client_id"] = options.ClientId,
            ["redirect_uri"] = options.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = string.Join(' ', GoogleScopes),
            ["access_type"] = "offline",
            // Forces Google to re-issue a refresh token even for a tenant that connected before
            // and is reconnecting - without this, a repeat consent can come back with no refresh
            // token at all, leaving nothing for the worker to use once the access token expires.
            ["prompt"] = "consent",
            ["state"] = state
        };

        return Results.Redirect(BuildUrl("https://accounts.google.com/o/oauth2/v2/auth", query));
    }

    private static async Task<IResult> GoogleCallbackAsync(
        HttpContext httpContext,
        string? code,
        string? state,
        string? error,
        AppDbContext db,
        ITenantContextAccessor tenantAccessor,
        IOptions<GoogleOAuthOptions> googleOptions,
        IOptions<MagicLinkOptions> magicLinkOptions,
        IDateTimeProvider clock,
        ILoggerFactory loggerFactory,
        CancellationToken token)
    {
        var frontendBaseUrl = magicLinkOptions.Value.BaseUrl.TrimEnd('/');
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        if (!string.IsNullOrWhiteSpace(error))
        {
            return Results.Redirect($"{frontendBaseUrl}/sources?error={Uri.EscapeDataString(error)}");
        }

        var expectedState = httpContext.Request.Cookies[GoogleStateCookie];
        httpContext.Response.Cookies.Delete(GoogleStateCookie);
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state) || state != expectedState)
        {
            return Results.Redirect($"{frontendBaseUrl}/sources?error=state_mismatch");
        }

        var options = googleOptions.Value;
        var http = OAuthHttpClient;
        var tokenResp = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["client_secret"] = options.ClientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = options.RedirectUri
        }), token);

        if (!tokenResp.IsSuccessStatusCode)
        {
            var body = await tokenResp.Content.ReadAsStringAsync(token);
            loggerFactory.CreateLogger("SourceOAuth").LogWarning("Google token exchange failed: {Status} {Body}", tokenResp.StatusCode, body);
            return Results.Redirect($"{frontendBaseUrl}/sources?error=token_exchange_failed");
        }

        var tokenDoc = await tokenResp.Content.ReadFromJsonAsync<GoogleTokenResponse>(cancellationToken: token);
        if (string.IsNullOrWhiteSpace(tokenDoc?.refresh_token))
        {
            // Google only omits this if the tenant already granted consent before without
            // access_type=offline/prompt=consent - shouldn't happen given we always send both,
            // but if it does, there's nothing durable to hand the worker.
            return Results.Redirect($"{frontendBaseUrl}/sources?error=no_refresh_token");
        }

        var tenantId = tenantAccessor.Current.TenantId;
        var source = new Source
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = SourceType.CloudImport,
            DisplayName = "Google Drive",
            ConfigJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["provider"] = "gdrive" }),
            CreatedAt = clock.UtcNow,
            CreatedByUserId = tenantAccessor.Current.UserId == Guid.Empty ? null : tenantAccessor.Current.UserId
        };
        db.Sources.Add(source);
        db.SourceSecrets.Add(new SourceSecret
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SourceId = source.Id,
            Key = "refreshToken",
            Value = tokenDoc.refresh_token,
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(token);

        return Results.Redirect($"{frontendBaseUrl}/sources?connected=google&sourceId={source.Id}");
    }

    private static IResult StartMicrosoftAsync(
        HttpContext httpContext,
        ITenantContextAccessor tenantAccessor,
        IOptions<MicrosoftOAuthOptions> microsoftOptions,
        ILoggerFactory loggerFactory)
    {
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        var options = microsoftOptions.Value;
        if (string.IsNullOrWhiteSpace(options.ClientId) || string.IsNullOrWhiteSpace(options.RedirectUri))
        {
            loggerFactory.CreateLogger("SourceOAuth").LogWarning("Microsoft OAuth is not configured (MicrosoftOAuth:ClientId/RedirectUri missing)");
            return Results.Problem("Microsoft OneDrive isn't configured on this server yet.", statusCode: 503);
        }

        var state = Guid.NewGuid().ToString("N");
        httpContext.Response.Cookies.Append(MicrosoftStateCookie, state, StateCookieOptions());

        var query = new Dictionary<string, string?>
        {
            ["client_id"] = options.ClientId,
            ["redirect_uri"] = options.RedirectUri,
            ["response_type"] = "code",
            ["response_mode"] = "query",
            ["scope"] = MicrosoftScope,
            ["state"] = state
        };

        return Results.Redirect(BuildUrl("https://login.microsoftonline.com/common/oauth2/v2.0/authorize", query));
    }

    private static async Task<IResult> MicrosoftCallbackAsync(
        HttpContext httpContext,
        string? code,
        string? state,
        string? error,
        AppDbContext db,
        ITenantContextAccessor tenantAccessor,
        IOptions<MicrosoftOAuthOptions> microsoftOptions,
        IOptions<MagicLinkOptions> magicLinkOptions,
        IDateTimeProvider clock,
        ILoggerFactory loggerFactory,
        CancellationToken token)
    {
        var frontendBaseUrl = magicLinkOptions.Value.BaseUrl.TrimEnd('/');
        if (!RecordVisibility.IsAdmin(tenantAccessor))
        {
            return Results.Forbid();
        }

        if (!string.IsNullOrWhiteSpace(error))
        {
            return Results.Redirect($"{frontendBaseUrl}/sources?error={Uri.EscapeDataString(error)}");
        }

        var expectedState = httpContext.Request.Cookies[MicrosoftStateCookie];
        httpContext.Response.Cookies.Delete(MicrosoftStateCookie);
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state) || state != expectedState)
        {
            return Results.Redirect($"{frontendBaseUrl}/sources?error=state_mismatch");
        }

        var options = microsoftOptions.Value;
        var http = OAuthHttpClient;
        var tokenResp = await http.PostAsync("https://login.microsoftonline.com/common/oauth2/v2.0/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["client_secret"] = options.ClientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = options.RedirectUri,
            ["scope"] = MicrosoftScope
        }), token);

        if (!tokenResp.IsSuccessStatusCode)
        {
            var body = await tokenResp.Content.ReadAsStringAsync(token);
            loggerFactory.CreateLogger("SourceOAuth").LogWarning("Microsoft token exchange failed: {Status} {Body}", tokenResp.StatusCode, body);
            return Results.Redirect($"{frontendBaseUrl}/sources?error=token_exchange_failed");
        }

        var tokenDoc = await tokenResp.Content.ReadFromJsonAsync<MicrosoftTokenResponse>(cancellationToken: token);
        if (string.IsNullOrWhiteSpace(tokenDoc?.refresh_token))
        {
            return Results.Redirect($"{frontendBaseUrl}/sources?error=no_refresh_token");
        }

        var tenantId = tenantAccessor.Current.TenantId;
        var source = new Source
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Type = SourceType.CloudImport,
            DisplayName = "Microsoft OneDrive",
            ConfigJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["provider"] = "onedrive" }),
            CreatedAt = clock.UtcNow,
            CreatedByUserId = tenantAccessor.Current.UserId == Guid.Empty ? null : tenantAccessor.Current.UserId
        };
        db.Sources.Add(source);
        db.SourceSecrets.Add(new SourceSecret
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SourceId = source.Id,
            Key = "refreshToken",
            Value = tokenDoc.refresh_token,
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(token);

        return Results.Redirect($"{frontendBaseUrl}/sources?connected=microsoft&sourceId={source.Id}");
    }

    private static CookieOptions StateCookieOptions() => new()
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Lax,
        MaxAge = TimeSpan.FromMinutes(10)
    };

    private static string BuildUrl(string baseUrl, Dictionary<string, string?> query)
    {
        var pairs = query
            .Where(kv => !string.IsNullOrEmpty(kv.Value))
            .Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value!)}");
        return $"{baseUrl}?{string.Join('&', pairs)}";
    }

    private sealed class GoogleTokenResponse
    {
        public string? access_token { get; set; }
        public string? refresh_token { get; set; }
        public int expires_in { get; set; }
    }

    private sealed class MicrosoftTokenResponse
    {
        public string? access_token { get; set; }
        public string? refresh_token { get; set; }
        public int expires_in { get; set; }
    }
}
