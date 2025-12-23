namespace CertiWatch.Api.Domain.Entities;

public sealed class User : BaseEntity
{
    public Guid TenantId { get; set; }
    public required string Email { get; set; }
    public string? Name { get; set; }
    public string Role { get; set; } = "admin";
    public Guid? InvitedByUserId { get; set; }
    public bool IsDisabled { get; set; } = false;
    public Tenant? Tenant { get; set; }
}
