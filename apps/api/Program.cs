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
using CertiWatch.Api.Features.Sources;
using CertiWatch.Api.Infrastructure.Emails;
using CertiWatch.Api.Infrastructure.Jobs;
using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Security;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Parsing;
using CertiWatch.Parsing.Text;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.Cookies;
using Serilog;
using CertiWatch.Contracts.Requests;

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
builder.Services.AddHostedService<WeeklyDigestJob>();

builder.Services.Configure<MagicLinkOptions>(builder.Configuration.GetSection("MagicLinks"));
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.Configure<ReminderOptions>(builder.Configuration.GetSection("Reminders"));

builder.Services.AddScoped<IValidator<CreateCourseRuleRequest>, CreateCourseRuleValidator>();
builder.Services.AddScoped<IValidator<UpdateCourseRuleRequest>, UpdateCourseRuleValidator>();

builder.Services.AddMediatR(typeof(Program));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.SlidingExpiration = true;
        options.Cookie.Name = "certiwatch_admin";
        options.LoginPath = "/login";
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseSecurityHeaders();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantResolutionMiddleware>();

app.MapAuthEndpoints();
app.MapAdminEndpoints();
app.MapDeviceEndpoints();
app.MapSourceEndpoints();
app.MapRecordEndpoints();
app.MapCourseRuleEndpoints();
app.MapReportEndpoints();
app.MapDocumentEndpoints();
app.MapNotificationEndpoints();

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
            context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            context.Response.Headers["X-Frame-Options"] = "DENY";
            await next();
        });
    }
}
