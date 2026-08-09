namespace CertiWatch.Contracts.Dtos;

// Status is a plain string ("compliant" | "expiring" | "expired" | "missing"), not a C# enum -
// this codebase has no JsonStringEnumConverter registered, so enums like ProcessingStatus
// serialize as raw ints and every frontend consumer has to defensively handle both int and
// string. A string field sidesteps that for this new endpoint.
// ExpiryDate is the matched record's expiry (null if none was extracted, or if nothing matched
// at all) - carried here mainly for the audit export, which needs to show "expiring 2026-09-01"
// rather than just "expiring". Harmless for the interactive matrix to receive too.
public sealed record ComplianceCellDto(Guid RequirementTypeId, string Status, DateOnly? ExpiryDate);
