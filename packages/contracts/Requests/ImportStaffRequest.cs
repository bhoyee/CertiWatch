namespace CertiWatch.Contracts.Requests;

public sealed record StaffImportRow(string Name, string? JobTitle, DateOnly? StartDate);

public sealed class ImportStaffRequest
{
    public required IReadOnlyList<StaffImportRow> Rows { get; init; }
}
