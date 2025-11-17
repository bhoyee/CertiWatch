using CertiWatch.Agent.Options;
using CertiWatch.Agent.Services;
using CertiWatch.Agent.Workers;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Agent"));
builder.Services.AddHttpClient<IAgentClient, AgentClient>()
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
    });
builder.Services.AddSingleton<IAgentQueue>(sp =>
{
    var options = sp.GetRequiredService<IOptions<AgentOptions>>().Value;
    return new FileAgentQueue(options.QueuePath);
});
builder.Services.AddHostedService<AgentWorker>();

builder.Services.AddLogging(logging => logging.AddConsole());

var host = builder.Build();
host.Run();
