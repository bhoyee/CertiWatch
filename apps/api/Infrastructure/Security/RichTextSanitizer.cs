using Ganss.Xss;

namespace CertiWatch.Api.Infrastructure.Security;

// The support ticket rich text editor (TipTap) is only sanitized client-side at render time
// (DOMPurify) - the raw HTML it produces is sent to the API and stored as-is otherwise, which
// means a stored ticket body can carry arbitrary markup/script. This sanitizes at write time too,
// so what's in the database (and what gets embedded directly into notification emails, where a
// missed script tag would run in the recipient's mail client) is always safe regardless of which
// client wrote it or whether that client's own sanitization was bypassed.
public static class RichTextSanitizer
{
    private static readonly HtmlSanitizer Sanitizer = CreateSanitizer();

    public static string Sanitize(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        return Sanitizer.Sanitize(html);
    }

    private static HtmlSanitizer CreateSanitizer()
    {
        var sanitizer = new HtmlSanitizer();

        // Matches exactly what the TipTap editor (StarterKit + Image + Link) can produce - nothing
        // else should ever reach storage or an email from this field.
        sanitizer.AllowedTags.Clear();
        foreach (var tag in new[] { "p", "br", "strong", "em", "s", "u", "ul", "ol", "li", "blockquote", "a", "img", "h2", "h3" })
        {
            sanitizer.AllowedTags.Add(tag);
        }

        sanitizer.AllowedAttributes.Clear();
        foreach (var attribute in new[] { "href", "src", "alt", "target", "rel" })
        {
            sanitizer.AllowedAttributes.Add(attribute);
        }

        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.Add("https");
        sanitizer.AllowedSchemes.Add("http");

        return sanitizer;
    }
}
