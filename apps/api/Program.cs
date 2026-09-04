using CertiWatch.Api.Configuration;
using CertiWatch.Api.Features.Admin;
using CertiWatch.Api.Features.Auth;
using CertiWatch.Api.Features.Compliance;
using CertiWatch.Api.Features.Devices;
using CertiWatch.Api.Features.Documents;
using CertiWatch.Api.Features.Notifications;
using CertiWatch.Api.Features.Records;
using CertiWatch.Api.Features.Reports;
using CertiWatch.Api.Features.Requirements;
using CertiWatch.Api.Features.Requirements.Validators;
using CertiWatch.Api.Features.Rules;
using CertiWatch.Api.Features.Rules.Validators;
using CertiWatch.Api.Features.Uploads;
using CertiWatch.Api.Features.Support;
using CertiWatch.Api.Features.Sources;
using CertiWatch.Api.Features.Staff;
using CertiWatch.Api.Features.Staff.Validators;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Jobs;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Api.Features.Billing;
using CertiWatch.Parsing;
using CertiWatch.Parsing.Text;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Serilog;
using CertiWatch.Contracts.Requests;
using Stripe;
using System.Security.Claims;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, cfg) =>
{
    cfg.ReadFrom.Configuration(ctx.Configuration)
        .Enrich.FromLogContext()
        .WriteTo.Console();
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddAppDbContext(builder.Configuration);

builder.Services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
builder.Services.AddSingleton<IIngestionQueue, RedisIngestionQueue>();
builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(_ =>
{
    var connectionString = builder.Configuration["Redis:ConnectionString"] ?? "redis:6379";
    var config = StackExchange.Redis.ConfigurationOptions.Parse(connectionString);
    config.AbortOnConnectFail = false;
    return StackExchange.Redis.ConnectionMultiplexer.Connect(config);
});
builder.Services.AddSingleton<IDeviceUploadRateLimiter, DeviceUploadRateLimiter>();
builder.Services.AddScoped<IRuleInferenceService, RuleInferenceService>();
builder.Services.AddSingleton<IEmailTemplateRenderer, EmailTemplateRenderer>();
builder.Services.AddSingleton<IEmailService, EmailService>();
builder.Services.AddSingleton<ITenantContextAccessor, TenantContextAccessor>();
builder.Services.AddScoped<IMagicLinkService, MagicLinkService>();

builder.Services.AddSingleton(new KeywordMatcher(KeywordMaps.Default));
builder.Services.AddSingleton<ParsingPipeline>();

builder.Services.AddHostedService<DocumentIngestionWorker>();
builder.Services.AddHostedService<ReminderScheduler>();
builder.Services.AddHostedService<ReminderSender>();
builder.Services.AddHostedService<WeeklyDigestJob>();

builder.Services.Configure<MagicLinkOptions>(builder.Configuration.GetSection("MagicLinks"));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.Configure<ReminderOptions>(builder.Configuration.GetSection("Reminders"));
builder.Services.Configure<StripeOptions>(builder.Configuration.GetSection("Stripe"));
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.PostConfigure<StorageOptions>(options =>
{
    if (string.IsNullOrWhiteSpace(options.UploadsRoot))
    {
        options.UploadsRoot = "/uploads";
    }

    Directory.CreateDirectory(options.UploadsRoot);
});
var stripeConfig = builder.Configuration.GetSection("Stripe").Get<StripeOptions>();
if (!string.IsNullOrWhiteSpace(stripeConfig?.SecretKey))
{
    StripeConfiguration.ApiKey = stripeConfig.SecretKey;
}

builder.Services.AddScoped<IValidator<CreateCourseRuleRequest>, CreateCourseRuleValidator>();
builder.Services.AddScoped<IValidator<UpdateCourseRuleRequest>, UpdateCourseRuleValidator>();
builder.Services.AddScoped<IValidator<CreateRequirementTypeRequest>, CreateRequirementTypeValidator>();
builder.Services.AddScoped<IValidator<UpdateRequirementTypeRequest>, UpdateRequirementTypeValidator>();
builder.Services.AddScoped<IValidator<CreateStaffMemberRequest>, CreateStaffMemberValidator>();
builder.Services.AddScoped<ITenantProvisioningService, TenantProvisioningService>();

builder.Services.AddMediatR(typeof(Program));

builder.Services.AddAuthentication(CwSessionAuthenticationDefaults.Scheme)
    .AddScheme<CwSessionAuthenticationOptions, CwSessionAuthenticationHandler>(
        CwSessionAuthenticationDefaults.Scheme,
        _ => { });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", p => p.RequireRole("admin", "superadmin"));
    options.AddPolicy("SuperAdmin", p => p.RequireRole("superadmin"));
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:3300", "http://127.0.0.1:3300")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

builder.Services.Configure<JsonOptions>(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

// Magic-link tokens are signed with this secret - if it's ever missing or left as a known
// placeholder outside Development, every login token becomes forgeable with a value that's
// sitting in the git history. Fail fast at startup instead of silently accepting it.
if (!app.Environment.IsDevelopment())
{
    var magicLinkSecret = app.Services.GetRequiredService<IOptions<MagicLinkOptions>>().Value.Secret;
    var knownPlaceholders = new[] { "dev-secret", "local-secret" };
    if (string.IsNullOrWhiteSpace(magicLinkSecret) || knownPlaceholders.Contains(magicLinkSecret))
    {
        throw new InvalidOperationException(
            "MagicLinks:Secret is missing or set to a known placeholder value. Set a real secret " +
            "via configuration (e.g. the MagicLinks__Secret environment variable) before starting " +
            "outside Development.");
    }
}

app.UseSerilogRequestLogging();
// Leave HTTPS redirection off for local/docker to avoid mixed-content/fetch failures.
app.UseSecurityHeaders();
app.UseCors();
app.UseAuthentication();
if (app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                new Claim(ClaimTypes.Email, "dev@certiwatch.local"),
                new Claim(ClaimTypes.Role, "admin"),
                new Claim("tenant_id", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
            };
            context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Dev"));
        }

        await next();
    });
}
app.UseAuthorization();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseMiddleware<SubscriptionGateMiddleware>();

app.MapAuthEndpoints();
app.MapPlatformAuthEndpoints();
app.MapAdminEndpoints();
app.MapPlatformEndpoints();
app.MapDeviceEndpoints();
app.MapSourceEndpoints();
app.MapRecordEndpoints();
app.MapCourseRuleEndpoints();
app.MapRequirementTypeEndpoints();
app.MapComplianceEndpoints();
app.MapReportEndpoints();
app.MapDocumentEndpoints();
app.MapNotificationEndpoints();
app.MapBillingEndpoints();
app.MapTenantEndpoints();
app.MapProfileEndpoints();
app.MapUserManagementEndpoints();
app.MapUploadEndpoints();
app.MapSupportEndpoints();
app.MapStaffEndpoints();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.Run();

// Top-level statements generate an internal Program class by default - WebApplicationFactory<T>
// (used by the integration tests in tests/ApiTests) needs a public type to reference.
public partial class Program;

public static class SecurityHeaderExtensions
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            context.Response.Headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
            context.Response.Headers["Content-Security-Policy"] =
                "default-src 'self'; frame-ancestors 'self' http://localhost:3300 http://127.0.0.1:3300";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            await next();
        });
    }
}
