using CertiWatch.Parsing.Models;
using CertiWatch.Parsing.Text;

namespace CertiWatch.Parsing;

public sealed class ParsingPipeline
{
    private readonly KeywordMatcher _keywordMatcher;

    public ParsingPipeline(KeywordMatcher keywordMatcher)
    {
        _keywordMatcher = keywordMatcher;
    }

    public ParsedDocument Parse(string rawText)
    {
        var normalized = TextNormalizer.Normalize(rawText);
        var keywordFields = _keywordMatcher.Extract(rawText).ToList();

        var confidence = keywordFields.Any()
            ? Math.Clamp(keywordFields.Average(f => f.Confidence), 0.3, 0.99)
            : 0.2;

        return new ParsedDocument
        {
            RawText = rawText,
            Lines = TextNormalizer.SplitLines(rawText),
            VendorHints = DetectVendorHints(normalized),
            Result = new ParsingResult
            {
                Fields = keywordFields,
                Confidence = confidence
            }
        };
    }

    private static List<string> DetectVendorHints(string text)
    {
        var hints = new List<string>();
        if (text.Contains("@", StringComparison.Ordinal))
        {
            hints.Add("email_domain");
        }

        if (text.Contains("www.", StringComparison.OrdinalIgnoreCase))
        {
            hints.Add("website");
        }

        return hints;
    }
}
