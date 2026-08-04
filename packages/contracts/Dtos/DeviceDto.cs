using CertiWatch.Contracts.Enums;

namespace CertiWatch.Contracts.Dtos;

public sealed record DeviceDto(
    Guid Id,
    string Name,
    string OperatingSystem,
    DeviceStatus Status,
    DateTime EnrolledAt,
    DateTime? LastSeenAt,
    IReadOnlyList<string> WatchPaths
);
