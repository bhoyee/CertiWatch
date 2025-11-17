using CertiWatch.Api.Domain.Entities;
using CertiWatch.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Services;

public interface ITenantProvisioningService
{
    Task<Tenant> ProvisionTenantAsync(string companyName, string planId, string adminEmail, string adminName, CancellationToken cancellationToken);
}

public sealed class TenantProvisioningService(AppDbContext dbContext, IDateTimeProvider clock) : ITenantProvisioningService
{
    public async Task<Tenant> ProvisionTenantAsync(string companyName, string planId, string adminEmail, string adminName, CancellationToken cancellationToken)
    {
        var existing = await dbContext.Tenants.Include(t => t.Users)
            .FirstOrDefaultAsync(t => t.Name == companyName || t.Users.Any(u => u.Email == adminEmail), cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = companyName,
            Plan = planId,
            CreatedAtUtc = clock.UtcNow
        };

        var admin = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Email = adminEmail,
            Name = adminName,
            Role = "admin",
            CreatedAt = clock.UtcNow
        };

        tenant.Users.Add(admin);
        dbContext.Tenants.Add(tenant);
        dbContext.Users.Add(admin);
        await dbContext.SaveChangesAsync(cancellationToken);
        return tenant;
    }
}
