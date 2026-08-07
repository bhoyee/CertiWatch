namespace CertiWatch.Contracts.Responses;

public sealed record StaffImportRowError(int Row, string Reason);

public sealed record StaffImportResultResponse(int Imported, IReadOnlyList<StaffImportRowError> Skipped);
