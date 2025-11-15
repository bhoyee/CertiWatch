using CertiWatch.Api.Configuration;
using Microsoft.Extensions.Options;

namespace CertiWatch.Api.Infrastructure.Services;

public interface IEmailService
{
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default);
}

public sealed class EmailService(IOptions<EmailOptions> options, ILogger<EmailService> logger) : IEmailService
{
    private readonly EmailOptions _options = options.Value;

    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("[Email] ({Provider}) To: {To} Subject: {Subject}",
            string.IsNullOrWhiteSpace(_options.ProviderApiKey) ? "debug" : "provider",
            to,
            subject);
        logger.LogDebug("Email body: {Body}", htmlBody);
        return Task.CompletedTask;
    }
}
