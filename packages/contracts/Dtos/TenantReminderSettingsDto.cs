namespace CertiWatch.Contracts.Dtos;

public sealed record TenantReminderSettingsDto(
    IReadOnlyList<int> LeadDays,
    bool IsCustom,
    IReadOnlyList<int> DefaultLeadDays);
