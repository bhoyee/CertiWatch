namespace CertiWatch.Parsing.Models;

public sealed class ParsedDocument
{
    public string RawText { get; init; } = string.Empty;
    public IReadOnlyList<string> Lines { get; init; } = Array.Empty<string>();
    public ParsingResult Result { get; init; } = new();
    public IReadOnlyList<string> VendorHints { get; init; } = Array.Empty<string>();
}
