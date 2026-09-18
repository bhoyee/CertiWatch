using CertiWatch.Contracts.Enums;

namespace CertiWatch.Api.Domain.Entities;

public sealed class Source : BaseEntity
{
    public Guid TenantId { get; set; }
    public SourceType Type { get; set; }
    public required string DisplayName { get; set; }
    public string ConfigJson { get; set; } = "{}";
    // The admin who connected this source (set at OAuth-connect time for Google Drive/OneDrive).
    // Auto-created placeholder sources ("Local Agent", "Worker Source") are left null - there's
    // no single owner for those, so document attribution falls back to the reporting Device
    // instead (see DocumentIngestionWorker's createdBy resolution).
    public Guid? CreatedByUserId { get; set; }
    // The standard "is this integration private or shared with the team" flag (same idea as a
    // Slack/Notion/Zapier connection) - true means every manager sees records from this source,
    // not just whoever connected it. Defaults true because every current connect path is
    // admin-only (see SourceOAuthEndpoints' IsAdmin gate) - there's no "a manager connected their
    // own private drive" case yet, so "admin-connected = shared with the team" is simply correct,
    // for existing sources too, not just new ones.
    public bool SharedWithAllManagers { get; set; } = true;
    public Tenant? Tenant { get; set; }
}
