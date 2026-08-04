using CertiWatch.Contracts.Enums;

namespace CertiWatch.Api.Domain.Entities;

public sealed class Device : BaseEntity
{
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public required string OperatingSystem { get; set; }
    public DeviceStatus Status { get; set; } = DeviceStatus.Unknown;
    public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSeenAt { get; set; }
    public string DeviceToken { get; set; } = string.Empty;
    // JSON array of folder paths this device's agent reports watching, updated on every
    // heartbeat - null/empty until the agent's first heartbeat after enrollment.
    public string? WatchPathsJson { get; set; }
    public Tenant? Tenant { get; set; }
}
