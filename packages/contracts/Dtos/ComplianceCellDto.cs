namespace CertiWatch.Contracts.Dtos;

// Status is a plain string ("compliant" | "expiring" | "expired" | "missing"), not a C# enum -
// this codebase has no JsonStringEnumConverter registered, so enums like ProcessingStatus
// serialize as raw ints and every frontend consumer has to defensively handle both int and
// string. A string field sidesteps that for this new endpoint.
public sealed record ComplianceCellDto(Guid RequirementTypeId, string Status);
