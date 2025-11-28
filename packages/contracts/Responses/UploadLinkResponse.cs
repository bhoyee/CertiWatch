namespace CertiWatch.Contracts.Responses;

public sealed record UploadLinkResponse(string Token, string Link, DateTime ExpiresAt);
