using System.Text.RegularExpressions;

namespace CertiWatch.Parsing.Text;

public static partial class TextNormalizer
{
    public static string Normalize(string input)
    {
        var collapsed = RegexWhitespace().Replace(input, " ");
        return collapsed.Trim();
    }

    public static IReadOnlyList<string> SplitLines(string input)
        => RegexLineBreak().Split(input)
            .Select(l => l.Trim())
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .ToArray();

    [GeneratedRegex(@"\s+", RegexOptions.Multiline)]
    private static partial Regex RegexWhitespace();

    [GeneratedRegex(@"\r?\n", RegexOptions.Multiline)]
    private static partial Regex RegexLineBreak();
}
