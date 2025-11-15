using CertiWatch.Contracts.Dtos;

namespace CertiWatch.Contracts.Responses;

public sealed record DigestPreviewResponse(TenantDigestDto Digest, string Html);
