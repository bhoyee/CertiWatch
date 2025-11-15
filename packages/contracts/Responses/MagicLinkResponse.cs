namespace CertiWatch.Contracts.Responses;

public sealed record MagicLinkResponse(bool Accepted, string? RedirectUrl = null, string? Message = null);
