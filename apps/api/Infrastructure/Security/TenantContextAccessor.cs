using CertiWatch.Contracts.Tenancy;

namespace CertiWatch.Api.Infrastructure.Security;

public interface ITenantContextAccessor
{
    TenantContext Current { get; }
    bool IsSet { get; }
    void Set(TenantContext context);
}

public sealed class TenantContextAccessor : ITenantContextAccessor
{
    private readonly AsyncLocal<TenantContext?> _current = new();

    public bool IsSet => _current.Value is not null;

    public TenantContext Current => _current.Value
        ?? throw new InvalidOperationException(
            "Tenant context has not been set for this request. This means the caller was never authenticated - " +
            "check that the endpoint requires authorization (or reads accessor.IsSet first if it's meant to work anonymously).");

    public void Set(TenantContext context)
    {
        _current.Value = context;
    }
}
