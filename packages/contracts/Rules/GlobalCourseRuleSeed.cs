namespace CertiWatch.Contracts.Rules;

public static class GlobalCourseRuleSeed
{
    public static IReadOnlyList<(string Course, int Months, bool Renewable)> Defaults { get; } = new List<(string, int, bool)>
    {
        ("First Aid", 36, true),
        ("Fire Safety", 12, true),
        ("Food Hygiene Level 2", 12, true),
        ("Manual Handling", 24, true),
        ("Safeguarding Adults", 24, true),
        ("GDPR Awareness", 12, true),
        ("Infection Control", 12, true),
        ("Health and Safety Induction", 36, true),
        ("Equality and Diversity", 36, true),
        ("COSHH Awareness", 12, true)
    };
}
