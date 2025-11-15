namespace CertiWatch.Api.Domain.Entities;

public sealed class CourseRule : BaseEntity
{
    public Guid? TenantId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public string? MatchRegex { get; set; }
    public string? Tag { get; set; }
    public string? IssuerOverride { get; set; }
    public int? DefaultValidityMonths { get; set; }
    public bool IsRenewable { get; set; } = true;
    public bool IsOneTime { get; set; }
    public bool IsGlobal => TenantId is null;
}
