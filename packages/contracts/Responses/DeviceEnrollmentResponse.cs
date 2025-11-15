namespace CertiWatch.Contracts.Responses;

public sealed record DeviceEnrollmentResponse(Guid DeviceId, string DeviceToken, DateTime ExpiresAt);
