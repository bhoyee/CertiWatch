namespace CertiWatch.Parsing;

public static class KeywordMaps
{
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> Default { get; } = new Dictionary<string, IReadOnlyList<string>>
    {
        ["staff_name"] = new[] {"name", "learner", "candidate"},
        ["course_name"] = new[] {"course", "training", "qualification"},
        ["issuer"] = new[] {"issuer", "provider", "awarding body", "by"},
        ["issue_date"] = new[] {"issued", "awarded", "completion date"},
        ["expiry_date"] = new[] {"expiry", "valid until", "renew by", "expires"}
    };
}
