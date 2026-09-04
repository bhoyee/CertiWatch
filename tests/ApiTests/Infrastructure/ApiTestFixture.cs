using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace CertiWatch.Api.Tests.Infrastructure;

// Real Postgres via Testcontainers - not EnsureCreated or an in-memory provider - so these tests
// run the actual EF migrations (including the baked-in RequirementType/CourseRule seed data) and
// the real Npgsql provider, not a stand-in that could hide a real bug. The host environment is
// deliberately NOT "Development": that's what keeps Program.cs's dev-only auto-admin auth bypass
// and Swagger off, so requests here go through the real CwSessionAuthenticationHandler - the
// entire point of the tenant-isolation and magic-link tests this fixture backs.
public sealed class ApiTestFixture : IAsyncLifetime
{
    public const string MagicLinkSecret = "integration-test-secret-do-not-use-in-prod";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16")
        .WithDatabase("certiwatch_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private WebApplicationFactory<Program>? _factory;

    private WebApplicationFactory<Program> Factory => _factory
        ?? throw new InvalidOperationException("ApiTestFixture.InitializeAsync has not completed yet.");

    public HttpClient CreateClient() => Factory.CreateClient();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // PersistenceExtensions.AddAppDbContext reads ConnectionStrings:postgres eagerly, as part
        // of Program.cs's top-level statements - long before WebApplicationFactory's own
        // ConfigureAppConfiguration hook gets merged in at Build() time. An override added there
        // arrives too late to affect it, so the connection string has to go in via environment
        // variables instead: those are already part of the configuration builder's default
        // sources from the moment WebApplication.CreateBuilder(args) runs, at the very top of the
        // file - early enough to actually be seen.
        Environment.SetEnvironmentVariable("ConnectionStrings__postgres", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("MagicLinks__Secret", MagicLinkSecret);
        Environment.SetEnvironmentVariable("MagicLinks__BaseUrl", "http://localhost:3300");
        Environment.SetEnvironmentVariable("Email__SmtpHost", string.Empty);

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("IntegrationTest");
        });

        // Force the factory to actually build the host now (it otherwise builds lazily on first
        // client/service access) so migrations run before any test tries to use the database.
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    // Runs `seed` against a real scoped AppDbContext and disposes the scope afterward - callers
    // don't need to manage DbContext lifetime themselves for what's normally a couple of Add +
    // SaveChanges calls.
    public async Task SeedAsync(Func<AppDbContext, Task> seed)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await seed(db);
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        await _postgres.DisposeAsync();
    }
}
