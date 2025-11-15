namespace CertiWatch.Contracts.Tenancy;

public sealed record TenantUser(Guid TenantId, Guid UserId, string Email, string Role);
