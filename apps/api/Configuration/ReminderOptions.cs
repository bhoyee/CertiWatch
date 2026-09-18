namespace CertiWatch.Api.Configuration;

public sealed class ReminderOptions
{
    // Empty, not pre-populated with {60,30,7,1} - ConfigurationBinder appends config-bound array
    // values onto whatever is already in the property rather than replacing it, so a non-empty
    // default here would silently double up with appsettings.json's own values (observed as
    // [60,30,7,1,60,30,7,1]). The real default is applied via PostConfigure in Program.cs, after
    // binding, only when config provided nothing - see the comment there.
    public int[] LeadDays { get; set; } = Array.Empty<int>();
    public TimeOnly DigestTime { get; set; } = new(9, 0);
    public string DigestTimeZone { get; set; } = "Europe/London";
}
