namespace CertiWatch.Api.Domain.Entities;

// Tracked for compliance purposes only - never needs a login account, so this is deliberately
// separate from User. Most care staff (carers, kitchen, cleaning) won't have one.
public sealed class StaffMember : BaseEntity
{
    public Guid TenantId { get; set; }
    public required string Name { get; set; }
    public string? JobTitle { get; set; }
    public DateOnly? StartDate { get; set; }
    public bool IsActive { get; set; } = true;
}
