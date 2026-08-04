using CertiWatch.Api.Configuration;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Mail;

namespace CertiWatch.Api.Infrastructure.Services;

public interface IEmailService
{
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default);
}

public sealed class EmailService(IOptions<EmailOptions> options, ILogger<EmailService> logger) : IEmailService
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.SmtpHost))
        {
            logger.LogInformation("[Email] (debug) To: {To} Subject: {Subject}", to, subject);
            // Logged at Information (not Debug) specifically so the magic link is actually visible
            // via `docker compose logs api` without needing to reconfigure Serilog's minimum level -
            // this is the only way to get the link when no real SMTP provider is configured.
            logger.LogInformation("[Email] (debug) Body: {Body}", htmlBody);
            return;
        }

        var useStartTls = _options.SmtpEncryption.Equals("starttls", StringComparison.OrdinalIgnoreCase);
        var useSsl = _options.SmtpEncryption.Equals("ssl", StringComparison.OrdinalIgnoreCase);

        using var client = new SmtpClient(_options.SmtpHost, _options.SmtpPort)
        {
            Credentials = new NetworkCredential(_options.SmtpUsername, _options.SmtpPassword),
            EnableSsl = useSsl || useStartTls,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false
        };

        var message = new MailMessage
        {
            From = new MailAddress(_options.FromAddress, _options.FromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        message.To.Add(to);

        try
        {
#pragma warning disable SYSLIB0014
            await client.SendMailAsync(message, cancellationToken);
#pragma warning restore SYSLIB0014
            logger.LogInformation("[Email] (smtp) sent To: {To} Subject: {Subject}", to, subject);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Email] failed To: {To} Subject: {Subject} Error: {Error}", to, subject, ex.Message);
            throw;
        }
    }
}
