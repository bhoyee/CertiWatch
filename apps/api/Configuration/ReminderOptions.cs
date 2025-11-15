namespace CertiWatch.Api.Configuration;

public sealed class ReminderOptions
{
    public IReadOnlyList<int> LeadDays { get; set; } = new[] { 60, 30, 7, 1 };
    public TimeOnly DigestTime { get; set; } = new(9, 0);
    public string DigestTimeZone { get; set; } = "Europe/London";
}
