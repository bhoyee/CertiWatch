using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace CertiWatch.Storage;

public static class ServiceCollectionExtensions
{
    // Reads config from a "Storage" section (Storage__Provider, Storage__UploadsRoot,
    // Storage__R2__* as env vars) in both the API and the worker, so the two processes always
    // agree on which provider is active without duplicating the switch logic in each.
    public static IServiceCollection AddFileStorage(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<StorageOptions>(configuration.GetSection("Storage"));
        services.AddSingleton<IFileStorage>(sp =>
        {
            var options = sp.GetRequiredService<IOptions<StorageOptions>>();
            return options.Value.Provider.Equals("R2", StringComparison.OrdinalIgnoreCase)
                ? new R2FileStorage(options)
                : new LocalDiskFileStorage(options);
        });
        return services;
    }
}
