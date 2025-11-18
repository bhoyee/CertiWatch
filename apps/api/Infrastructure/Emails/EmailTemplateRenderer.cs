using System.Text;
using System.Text.RegularExpressions;
using CertiWatch.Contracts.Dtos;

namespace CertiWatch.Api.Infrastructure.Emails;

public interface IEmailTemplateRenderer
{
    string RenderDigest(TenantDigestDto digest);
    string RenderReminder(RecordDto record, DateOnly reminderDate);
    string RenderWelcome(string companyName, string planName, string adminName, string adminEmail, string magicLink);
    string RenderMagicLink(string adminEmail, string link);
}

public sealed class EmailTemplateRenderer : IEmailTemplateRenderer
{
    private readonly string _digestTemplate;
    private readonly string _reminderTemplate;
    private readonly string _welcomeTemplate;
    private readonly string _magicTemplate;

    public EmailTemplateRenderer()
    {
        _digestTemplate = LoadTemplate("digest.html");
        _reminderTemplate = LoadTemplate("reminder.html");
        _welcomeTemplate = LoadTemplate("welcome.html");
        _magicTemplate = LoadTemplate("magic-link.html");
    }

    public string RenderDigest(TenantDigestDto digest)
    {
        var builder = new StringBuilder(_digestTemplate);
        builder.Replace("{{tenant_name}}", digest.TenantName);
        builder.Replace("{{new_records}}", digest.NewRecords.Count.ToString());
        builder.Replace("{{expiring}}", digest.ExpiringSoon.Count.ToString());
        builder.Replace("{{expired}}", digest.Expired.Count.ToString());
        builder.Replace("{{low_confidence}}", digest.LowConfidence.Count.ToString());
        return builder.ToString();
    }

    public string RenderReminder(RecordDto record, DateOnly reminderDate)
    {
        var builder = new StringBuilder(_reminderTemplate);
        builder.Replace("{{staff_name}}", record.StaffName);
        builder.Replace("{{course_name}}", record.CourseName);
        builder.Replace("{{reminder_date}}", reminderDate.ToString("yyyy-MM-dd"));
        return builder.ToString();
    }

    public string RenderWelcome(string companyName, string planName, string adminName, string adminEmail, string magicLink)
    {
        var builder = new StringBuilder(_welcomeTemplate);
        builder.Replace("{{company_name}}", companyName);
        builder.Replace("{{plan_name}}", planName);
        builder.Replace("{{admin_name}}", adminName);
        builder.Replace("{{admin_email}}", adminEmail);
        builder.Replace("{{magic_link}}", magicLink);
        return builder.ToString();
    }

    public string RenderMagicLink(string adminEmail, string link)
    {
        var builder = new StringBuilder(_magicTemplate);
        builder.Replace("{{admin_email}}", adminEmail);
        builder.Replace("{{magic_link}}", link);
        return builder.ToString();
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
