using System.Text;
using System.Text.RegularExpressions;
using CertiWatch.Contracts.Dtos;

namespace CertiWatch.Api.Infrastructure.Emails;

public interface IEmailTemplateRenderer
{
    string RenderDigest(TenantDigestDto digest);
    string RenderReminder(RecordDto record, DateOnly reminderDate);
}

public sealed class EmailTemplateRenderer : IEmailTemplateRenderer
{
    private readonly string _digestTemplate;
    private readonly string _reminderTemplate;

    public EmailTemplateRenderer()
    {
        _digestTemplate = LoadTemplate("digest.html");
        _reminderTemplate = LoadTemplate("reminder.html");
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

    private static string LoadTemplate(string fileName)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "emails", fileName);
        return File.Exists(path)
            ? File.ReadAllText(path)
            : $"Template missing: {fileName}";
    }
}
