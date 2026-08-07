namespace CertiWatch.Contracts.Requests;

public sealed class UpdateStaffMemberRequest
{
    public string? Name { get; init; }
    public string? JobTitle { get; init; }
    public DateOnly? StartDate { get; init; }
    public bool? IsActive { get; init; }
}
