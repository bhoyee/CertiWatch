namespace CertiWatch.Contracts.Requests;

public sealed class CreateStaffMemberRequest
{
    public required string Name { get; init; }
    public string? JobTitle { get; init; }
    public DateOnly? StartDate { get; init; }
}
