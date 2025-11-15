using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CertiWatch.Api.Infrastructure.Persistence;

public static class PersistenceExtensions
{
    public static IServiceCollection AddAppDbContext(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("postgres") ?? configuration["POSTGRES_URL"] ?? "Host=localhost;Username=postgres;Password=postgres;Database=certiwatch";
        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString, builder => builder.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)));
        return services;
    }
}
