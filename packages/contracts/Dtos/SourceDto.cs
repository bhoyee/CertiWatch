using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Dtos;

public sealed record SourceDto(
    Guid Id,
    SourceType Type,
    string DisplayName,
    IReadOnlyDictionary<string, string> Config,
    DateTime CreatedAt,
    string? LastSync = null,
    string? SyncStatus = null,
    string? SyncError = null
);
