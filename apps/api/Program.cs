using CertiWatch.Api.Configuration;
using CertiWatch.Api.Features.Admin;
using CertiWatch.Api.Features.Auth;
using CertiWatch.Api.Features.Devices;
using CertiWatch.Api.Features.Documents;
using CertiWatch.Api.Features.Notifications;
using CertiWatch.Api.Features.Records;
using CertiWatch.Api.Features.Reports;
using CertiWatch.Api.Features.Rules;
using CertiWatch.Api.Features.Rules.Validators;
using CertiWatch.Api.Features.Uploads;
using CertiWatch.Api.Features.Support;
using CertiWatch.Api.Features.Sources;
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
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Serilog;
using CertiWatch.Contracts.Requests;
using Stripe;
using System.Security.Claims;

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
builder.Services.AddSingleton<IIngestionQueue, InMemoryIngestionQueue>();
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
builder.Services.AddScoped<ITenantProvisioningService, TenantProvisioningService>();

builder.Services.AddMediatR(typeof(Program));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.SlidingExpiration = true;
        options.Cookie.Name = "certiwatch_admin";
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.LoginPath = "/login";
    });

builder.Services.AddAuthorization();

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

app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
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
app.MapAdminEndpoints();
app.MapPlatformEndpoints();
app.MapDeviceEndpoints();
app.MapSourceEndpoints();
app.MapRecordEndpoints();
app.MapCourseRuleEndpoints();
app.MapReportEndpoints();
app.MapDocumentEndpoints();
app.MapNotificationEndpoints();
app.MapBillingEndpoints();
app.MapTenantEndpoints();
app.MapProfileEndpoints();
app.MapUserManagementEndpoints();
app.MapUploadEndpoints();
app.MapSupportEndpoints();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.Run();

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
