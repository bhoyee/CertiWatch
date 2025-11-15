namespace CertiWatch.Parsing.Models;

public sealed class ParsingResult
{
    public IReadOnlyList<ParsedField> Fields { get; init; } = Array.Empty<ParsedField>();
    public double Confidence { get; init; }
    public string? StaffName => Fields.FirstOrDefault(f => f.Key == "staff_name")?.Value;
    public string? CourseName => Fields.FirstOrDefault(f => f.Key == "course_name")?.Value;
    public string? Issuer => Fields.FirstOrDefault(f => f.Key == "issuer")?.Value;
    public DateOnly? IssueDate => TryParseDate("issue_date");
    public DateOnly? ExpiryDate => TryParseDate("expiry_date");

    private DateOnly? TryParseDate(string key)
    {
        var text = Fields.FirstOrDefault(f => f.Key == key)?.Value;
        if (text is null)
        {
            return null;
        }

        if (DateTime.TryParse(text, out var dt))
        {
            return DateOnly.FromDateTime(dt);
        }

        return null;
    }
}
