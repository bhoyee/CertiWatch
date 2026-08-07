namespace CertiWatch.Api.Domain.Entities;

// The staff-side compliance checklist catalog ("who needs what"), distinct from CourseRule
// (which drives OCR/extraction-time expiry inference for uploaded documents). Global rows
// (TenantId null) are the seeded catalog; tenants can add their own alongside them.
public sealed class RequirementType : BaseEntity
{
    public Guid? TenantId { get; set; }
    public required string Name { get; set; }
    public int? DefaultValidityMonths { get; set; }
    public bool IsRenewable { get; set; } = true;
    public bool IsGlobal => TenantId is null;
}
