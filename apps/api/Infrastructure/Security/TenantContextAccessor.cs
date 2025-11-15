using CertiWatch.Contracts.Tenancy;

namespace CertiWatch.Api.Infrastructure.Security;

public interface ITenantContextAccessor
{
    TenantContext Current { get; }
    void Set(TenantContext context);
}

public sealed class TenantContextAccessor : ITenantContextAccessor
{
    private readonly AsyncLocal<TenantContext?> _current = new();

    public TenantContext Current => _current.Value ?? new TenantContext
    {
        TenantId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        UserId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        Email = "system@certiwatch.local",
        Role = "admin"
    };

    public void Set(TenantContext context)
    {
        _current.Value = context;
    }
}
