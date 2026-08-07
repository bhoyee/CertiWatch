namespace CertiWatch.Contracts.Dtos;

public sealed record StaffMemberDto(
    Guid Id,
    string Name,
    string? JobTitle,
    DateOnly? StartDate,
    bool IsActive,
    DateTime CreatedAt
);
