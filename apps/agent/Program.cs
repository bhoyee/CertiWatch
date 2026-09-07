using CertiWatch.Agent.Options;
using CertiWatch.Agent.Services;
using CertiWatch.Agent.Workers;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Serilog;

// Running as a Windows Service means there's no attached console for AddConsole() to write to -
// those log lines (including exactly the "why didn't my device show up" enrollment failures this
// was added to diagnose) were going nowhere. A rolling file next to the executable means a
// failure is always inspectable after the fact, regardless of how the process is hosted.
var logDirectory = Path.Combine(AppContext.BaseDirectory, "logs");
Directory.CreateDirectory(logDirectory);
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.File(
        Path.Combine(logDirectory, "agent-.log"),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 14)
    .CreateLogger();

var builder = Host.CreateApplicationBuilder(args);
builder.Logging.ClearProviders();
builder.Services.AddSerilog();

// Lets the one-line installer write a single plain JSON file next to the binary instead of
// dealing with per-OS environment-variable registration (particularly awkward for a Windows
// Service). Added after the default sources, so it wins over the shipped appsettings.json
// defaults; Agent__* environment variables (used by the systemd unit / manual install path)
// keep working unchanged since this doesn't replace that source, only adds another one.
builder.Configuration.AddJsonFile(Path.Combine(AppContext.BaseDirectory, "agent.settings.json"), optional: true, reloadOnChange: false);

builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Agent"));
builder.Services.AddHttpClient<IAgentClient, AgentClient>()
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
    });
builder.Services.AddSingleton<IProcessedFileStore>(sp =>
{
    var options = sp.GetRequiredService<IOptions<AgentOptions>>().Value;
    return new ProcessedFileStore(options.ProcessedFilesPath);
});
builder.Services.AddSingleton<IDeviceCredentialStore>(sp =>
{
    var options = sp.GetRequiredService<IOptions<AgentOptions>>().Value;
    return new DeviceCredentialStore(options.CredentialsPath);
});
builder.Services.AddHostedService<AgentWorker>();

// Both are safe no-ops unless the process is actually running under that specific host manager -
// a plain .NET Generic Host process doesn't speak the Windows Service Control Manager protocol
// without AddWindowsService(), so New-Service-created services would otherwise fail to start.
builder.Services.AddWindowsService();
builder.Services.AddSystemd();

var host = builder.Build();
host.Run();
