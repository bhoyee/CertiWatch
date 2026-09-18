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
    // Whoever minted the enrollment code this device was enrolled with (copied from
    // DeviceEnrollmentCode.CreatedByUserId at enroll time - the enroll call itself is anonymous,
    // made by the device agent, not a logged-in user). Used as a fallback attribution for
    // documents this device reports, so manager visibility scoping has something to key off for
    // folder-watching ingestion, which otherwise has no "acting user" at all.
    public Guid? CreatedByUserId { get; set; }
    public Tenant? Tenant { get; set; }
}
