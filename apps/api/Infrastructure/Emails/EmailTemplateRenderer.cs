using System.Net;
using System.Text;
using CertiWatch.Api.Configuration;
using CertiWatch.Contracts.Dtos;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Emails;

public interface IEmailTemplateRenderer
{
    string RenderDigest(TenantDigestDto digest);
    string RenderReminder(RecordDto record, DateOnly reminderDate);
    string RenderWelcome(string companyName, string planName, string adminName, string adminEmail, string magicLink);
    string RenderMagicLink(string adminEmail, string link);
}

// Templates on disk hold only the body content for their email (heading, copy, and a couple of
// {{placeholder}} slots) - the branded header/card/footer shell, buttons, and info boxes are all
// supplied by EmailLayout so every email looks like the same product regardless of which template
// (or hand-built C# string elsewhere) produced it.
public sealed class EmailTemplateRenderer : IEmailTemplateRenderer
{
    private readonly string _digestTemplate;
    private readonly string _reminderTemplate;
    private readonly string _welcomeTemplate;
    private readonly string _magicTemplate;
    private readonly string _baseUrl;

    public EmailTemplateRenderer(IOptions<MagicLinkOptions> magicOptions)
    {
        _baseUrl = magicOptions.Value.BaseUrl.TrimEnd('/');
        _digestTemplate = LoadTemplate("digest.html");
        _reminderTemplate = LoadTemplate("reminder.html");
        _welcomeTemplate = LoadTemplate("welcome.html");
        _magicTemplate = LoadTemplate("magic-link.html");
    }

    public string RenderDigest(TenantDigestDto digest)
    {
        var subject = $"CertiWatch Weekly Digest — {digest.TenantName}";
        var builder = new StringBuilder(_digestTemplate);
        builder.Replace("{{tenant_name}}", WebUtility.HtmlEncode(digest.TenantName));
        builder.Replace("{{stats_grid}}", BuildDigestStatsGrid(digest));
        builder.Replace("{{cta_button}}", EmailLayout.Button($"{_baseUrl}/analytics", "Open dashboard"));
        return EmailLayout.Wrap(subject, builder.ToString());
    }

    public string RenderReminder(RecordDto record, DateOnly reminderDate)
    {
        var subject = $"Certificate expiring soon — {record.CourseName}";
        var infoBox = EmailLayout.InfoBox(
            EmailLayout.InfoRow("Staff", WebUtility.HtmlEncode(record.StaffName)) +
            EmailLayout.InfoRow("Requirement", WebUtility.HtmlEncode(record.CourseName)) +
            EmailLayout.InfoRow("Expiry date", reminderDate.ToString("d MMMM yyyy")));
        var builder = new StringBuilder(_reminderTemplate);
        builder.Replace("{{info_box}}", infoBox);
        builder.Replace("{{cta_button}}", EmailLayout.Button($"{_baseUrl}/records", "View record"));
        return EmailLayout.Wrap(subject, builder.ToString());
    }

    public string RenderWelcome(string companyName, string planName, string adminName, string adminEmail, string magicLink)
    {
        var subject = $"Welcome to CertiWatch ({planName})";
        var infoBox = EmailLayout.InfoBox(
            EmailLayout.InfoRow("Admin email", WebUtility.HtmlEncode(adminEmail)) +
            EmailLayout.InfoRow("Plan", WebUtility.HtmlEncode(planName)) +
            EmailLayout.InfoRow("Trial", "7 days"));
        var builder = new StringBuilder(_welcomeTemplate);
        builder.Replace("{{company_name}}", WebUtility.HtmlEncode(companyName));
        builder.Replace("{{plan_name}}", WebUtility.HtmlEncode(planName));
        builder.Replace("{{admin_name}}", WebUtility.HtmlEncode(adminName));
        builder.Replace("{{info_box}}", infoBox);
        builder.Replace("{{cta_button}}", EmailLayout.Button(magicLink, "Sign in now"));
        return EmailLayout.Wrap(subject, builder.ToString());
    }

    public string RenderMagicLink(string adminEmail, string link)
    {
        const string subject = "Your CertiWatch sign-in link";
        var builder = new StringBuilder(_magicTemplate);
        builder.Replace("{{admin_email}}", WebUtility.HtmlEncode(adminEmail));
        builder.Replace("{{cta_button}}", EmailLayout.Button(link, "Sign in to CertiWatch"));
        return EmailLayout.Wrap(subject, builder.ToString());
    }

    private static string BuildDigestStatsGrid(TenantDigestDto digest)
    {
        var tiles = new (string Label, int Value, string Color, string Background)[]
        {
            ("New records", digest.NewRecords.Count, "#4f46e5", "#eef2ff"),
            ("Expiring soon", digest.ExpiringSoon.Count, "#b45309", "#fef3c7"),
            ("Expired", digest.Expired.Count, "#be123c", "#ffe4e6"),
            ("Low confidence", digest.LowConfidence.Count, "#475569", "#f1f5f9")
        };

        var rows = new StringBuilder();
        for (var i = 0; i < tiles.Length; i += 2)
        {
            rows.Append("<tr>");
            for (var j = i; j < i + 2 && j < tiles.Length; j++)
            {
                var tile = tiles[j];
                rows.Append($"""
                    <td width="50%" style="padding:6px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{tile.Background}; border-radius:8px;">
                        <tr>
                          <td style="padding:14px 16px;">
                            <div style="font-size:22px; font-weight:700; color:{tile.Color};">{tile.Value}</div>
                            <div style="font-size:12px; color:#475569; margin-top:2px;">{tile.Label}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    """);
            }
            rows.Append("</tr>");
        }

        return $"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">{rows}</table>""";
    }

    private static string LoadTemplate(string fileName)
    {
        var baseDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(baseDir, "emails", fileName),
            Path.Combine(baseDir, "..", "..", "..", "..", "emails", fileName)
        };

        foreach (var path in candidates)
        {
            if (File.Exists(path))
            {
                return File.ReadAllText(path);
            }
        }

        return $"Template missing: {fileName}";
    }
}
