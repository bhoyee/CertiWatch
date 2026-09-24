using System.Net;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Services;

namespace CertiWatch.Api.Features.Contact;

// The public marketing site's "Contact" popup posts here - no login, no tenant, just "send this
// message to CertiWatch". Not tenant-configurable (unlike, say, support tickets, which belong to
// a specific tenant) since this is about the product itself, not something inside it.
public static class ContactEndpoints
{
    // Fixed on purpose - this is the one inbox for the marketing site's contact form, not
    // something a caller should ever be able to redirect via request data.
    private const string RecipientEmail = "salisu.adeboye@gmail.com";
    private const double MinSecondsBeforeSubmit = 3;

    public static IEndpointRouteBuilder MapContactEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/api/contact", SubmitAsync).AllowAnonymous().DisableAntiforgery().RequireRateLimiting("contact");
        return routes;
    }

    private static async Task<IResult> SubmitAsync(
        ContactRequest request,
        IEmailService emailService,
        ILoggerFactory loggerFactory,
        CancellationToken token)
    {
        var logger = loggerFactory.CreateLogger("ContactEndpoints");

        // Honeypot: a real visitor never sees this field (hidden off-screen via CSS, not just
        // display:none - some bots skip display:none fields specifically). A bot that blindly
        // fills every input it finds in the form will populate it. Answer with the same success
        // response as a real submission instead of an error, so a scripted sender has no signal
        // to react to and doesn't bother retrying differently.
        if (!string.IsNullOrWhiteSpace(request.Website))
        {
            logger.LogInformation("Contact form honeypot triggered; discarding");
            return Results.Ok(new { ok = true });
        }

        // A human takes at least a few seconds to read the form and type a name, email, and
        // message; most spam scripts submit within milliseconds of loading the page. The
        // timestamp comes from the client (when the form rendered), so this is a cheap signal,
        // not a security boundary - it works alongside the honeypot and rate limit, not instead
        // of them.
        if (request.RenderedAtUnixMs > 0)
        {
            var elapsedSeconds = (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - request.RenderedAtUnixMs) / 1000.0;
            if (elapsedSeconds < MinSecondsBeforeSubmit)
            {
                logger.LogInformation("Contact form submitted too quickly ({Seconds}s); discarding", elapsedSeconds);
                return Results.Ok(new { ok = true });
            }
        }

        var name = (request.Name ?? string.Empty).Trim();
        var email = (request.Email ?? string.Empty).Trim();
        var message = (request.Message ?? string.Empty).Trim();

        if (name.Length is 0 or > 200 || message.Length is 0 or > 5000 || !IsPlausibleEmail(email))
        {
            return Results.BadRequest(new { error = "Please fill in your name, a valid email, and a message." });
        }

        var encodedName = WebUtility.HtmlEncode(name);
        var encodedEmail = WebUtility.HtmlEncode(email);
        var encodedMessage = WebUtility.HtmlEncode(message).Replace("\n", "<br/>");

        var subject = $"CertiWatch contact form — {name}";
        var html = EmailLayout.Wrap(subject,
            EmailLayout.Heading("New message from the website") +
            EmailLayout.InfoBox(
                EmailLayout.InfoRow("Name", encodedName) +
                EmailLayout.InfoRow("Email", encodedEmail)) +
            EmailLayout.Paragraph(encodedMessage) +
            EmailLayout.MutedText($"Sent from the CertiWatch contact form · {DateTime.UtcNow:dd MMM yyyy, HH:mm} UTC"));

        await emailService.SendAsync(RecipientEmail, subject, html, token);
        return Results.Ok(new { ok = true });
    }

    private static bool IsPlausibleEmail(string email) =>
        !string.IsNullOrWhiteSpace(email)
        && email.Length <= 320
        && !email.Contains(' ')
        && email.Contains('@')
        && email.IndexOf('@') < email.LastIndexOf('.');
}

public sealed record ContactRequest(string? Name, string? Email, string? Message, string? Website, long RenderedAtUnixMs);
