using System.Text.RegularExpressions;
using CertiWatch.Parsing.Models;

namespace CertiWatch.Parsing.Text;

public sealed class KeywordMatcher
{
    private readonly IReadOnlyDictionary<string, IReadOnlyList<string>> _keywords;

    public KeywordMatcher(IReadOnlyDictionary<string, IReadOnlyList<string>> keywords)
    {
        _keywords = keywords;
    }

    public IReadOnlyList<ParsedField> Extract(string text)
    {
        var results = new List<ParsedField>();
        var lines = TextNormalizer.SplitLines(text).ToArray();

        for (var lineIndex = 0; lineIndex < lines.Length; lineIndex++)
        {
            var line = lines[lineIndex];
            foreach (var pair in _keywords)
            {
                if (pair.Value.Any(keyword => line.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
                {
                    var value = ExtractValue(line);
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        results.Add(new ParsedField(pair.Key, value, Confidence: 0.55 + pair.Value.Count * 0.02, (lineIndex + 1, 1)));
                    }
                }
            }
        }

        return results;
    }

    private static string ExtractValue(string line)
    {
        if (line.Contains(":", StringComparison.Ordinal))
        {
            return line[(line.IndexOf(':') + 1)..].Trim();
        }

        var match = Regex.Match(line, @"-?\s*(?<value>[A-Za-z0-9 ,.\/-]{4,})$");
        return match.Success ? match.Groups["value"].Value.Trim() : line.Trim();
    }
}
