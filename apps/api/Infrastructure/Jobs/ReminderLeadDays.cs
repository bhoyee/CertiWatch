namespace CertiWatch.Api.Infrastructure.Jobs;

// Shared parse/format/validate logic for a tenant's optional custom reminder lead-day list, so
// the scheduler and the settings endpoint can't drift out of sync on what counts as valid.
internal static class ReminderLeadDays
{
    public const int MinDays = 1;
    public const int MaxDays = 365;
    public const int MaxCount = 8;

    public static IReadOnlyList<int>? Parse(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv))
        {
            return null;
        }

        var values = csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var n) ? n : (int?)null)
            .Where(n => n.HasValue)
            .Select(n => n!.Value)
            .ToList();
        return values.Count > 0 ? values : null;
    }

    // Dedupes, sorts descending (matching the global default's own order), and validates range
    // and count so the stored value and the UI always agree on what's presentable.
    public static (bool Ok, string? Error, IReadOnlyList<int> Cleaned) Validate(IEnumerable<int> values)
    {
        var cleaned = values.Distinct().OrderByDescending(v => v).ToList();
        if (cleaned.Count == 0)
        {
            return (false, "At least one lead day is required.", cleaned);
        }
        if (cleaned.Count > MaxCount)
        {
            return (false, $"No more than {MaxCount} lead days are allowed.", cleaned);
        }
        if (cleaned.Any(v => v < MinDays || v > MaxDays))
        {
            return (false, $"Each lead day must be between {MinDays} and {MaxDays}.", cleaned);
        }
        return (true, null, cleaned);
    }

    public static string ToCsv(IEnumerable<int> values) => string.Join(",", values);
}
