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
using CertiWatch.Storage;
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
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
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
// Applied after binding, only when "Reminders:LeadDays" was absent from config entirely - see
// the comment on ReminderOptions.LeadDays for why the default can't just live on the property.
builder.Services.PostConfigure<ReminderOptions>(options =>
{
    if (options.LeadDays.Length == 0)
    {
        options.LeadDays = new[] { 60, 30, 7, 1 };
    }
});
builder.Services.Configure<StripeOptions>(builder.Configuration.GetSection("Stripe"));
builder.Services.Configure<GoogleOAuthOptions>(builder.Configuration.GetSection("GoogleOAuth"));
builder.Services.Configure<MicrosoftOAuthOptions>(builder.Configuration.GetSection("MicrosoftOAuth"));
builder.Services.AddFileStorage(builder.Configuration);
builder.Services.PostConfigure<StorageOptions>(options =>
{
    if (string.IsNullOrWhiteSpace(options.UploadsRoot))
    {
        options.UploadsRoot = "/uploads";
    }

    // Only matters for the Disk provider - an R2-backed deployment has no reason to touch the
    // local filesystem at all, and may not even have a writable one.
    if (options.Provider.Equals("Disk", StringComparison.OrdinalIgnoreCase))
    {
        Directory.CreateDirectory(options.UploadsRoot);
    }
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

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        return new ValueTask(context.HttpContext.Response.WriteAsync(
            """{"error":"rate_limited","message":"Too many requests - please wait a moment and try again."}""",
            token));
    };

    // Blanket floor under every request, partitioned by caller IP - not meant to be precise, just
    // to blunt a scripted flood hitting the API directly. The named policies below are the real
    // protection for anything security-sensitive (login, signup, invites).
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Login/signup/magic-link-verify - the classic brute-force, credential-stuffing, and spam
    // targets, all of which are anonymous (no session yet) so IP is the only signal available.
    // Loose enough that a real user mistyping their email or asking for a second link doesn't get
    // blocked; tight enough that scripted abuse (and burning real SMTP send quota) isn't viable.
    options.AddPolicy<string>("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 8,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0
            }));

    // Slightly more headroom than "auth" - a real admin onboarding a team can legitimately send
    // several invites in one sitting.
    options.AddPolicy<string>("invite", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0
            }));
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
app.UseRateLimiter();
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
app.MapSourceOAuthEndpoints();
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
