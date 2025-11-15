namespace CertiWatch.Parsing.Vendors;

public sealed class VendorProfile
{
    public required string Name { get; init; }
    public IReadOnlyList<string> Hints { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Patterns { get; init; } = new Dictionary<string, string>();
}
