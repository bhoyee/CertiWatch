namespace CertiWatch.Contracts.Responses;

public sealed record MagicLinkVerifyResponse(string Email, Guid TenantId);
