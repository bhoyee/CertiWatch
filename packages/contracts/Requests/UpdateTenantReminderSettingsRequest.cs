namespace CertiWatch.Contracts.Requests;

// A null or empty LeadDays resets the tenant back to the global default schedule.
public sealed record UpdateTenantReminderSettingsRequest(List<int>? LeadDays);
