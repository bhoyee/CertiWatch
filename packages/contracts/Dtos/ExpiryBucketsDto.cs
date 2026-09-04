namespace CertiWatch.Contracts.Dtos;

// Buckets only ever count records that haven't expired yet - Next7 through Next90Plus form a
// forward-looking horizon, distinct from the already-expired count tracked elsewhere.
public sealed record ExpiryBucketsDto(int Next7, int Next30, int Next60, int Next90Plus);
