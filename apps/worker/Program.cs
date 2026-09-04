using CertiWatch.Parsing;
using CertiWatch.Parsing.Text;
using CertiWatch.Worker.Options;
using CertiWatch.Worker.Services;
using CertiWatch.Worker.Workers;
using Serilog;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<WorkerOptions>(builder.Configuration.GetSection("Worker"));
builder.Services.AddHttpClient<IApiClient, ApiClient>()
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
    });
builder.Services.AddSingleton(new KeywordMatcher(KeywordMaps.Default));
builder.Services.AddSingleton<ParsingPipeline>();
builder.Services.AddHttpClient<IOcrSpaceClient, OcrSpaceClient>();
builder.Services.AddSingleton<ITesseractClient, TesseractClient>();
builder.Services.AddHttpClient<IDoctrClient, DoctrClient>();
builder.Services.AddHttpClient<IDeepSeekClient, DeepSeekClient>();
builder.Services.AddHostedService<OcrWorker>();
builder.Services.AddHttpClient("cloud-sync");
builder.Services.AddHostedService<CloudImportWorker>();

builder.Services.AddLogging(logging =>
{
    logging.AddConsole();
});

var host = builder.Build();
host.Run();
