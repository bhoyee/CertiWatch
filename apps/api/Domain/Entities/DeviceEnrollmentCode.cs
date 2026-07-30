namespace CertiWatch.Api.Domain.Entities;

// A short-lived, hashed code an admin mints so a device/agent can prove it belongs to their
// tenant during /api/devices/enroll, without the enroll call needing to trust a client-supplied
// tenant id. Only CodeHash is stored - the plaintext is shown to the admin once, at mint time.
public sealed class DeviceEnrollmentCode : BaseEntity
{
    public Guid TenantId { get; set; }
    public required string CodeHash { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public Tenant? Tenant { get; set; }
}
