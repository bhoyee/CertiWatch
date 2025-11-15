namespace CertiWatch.Parsing.Samples;

public static class SampleDocumentLibrary
{
    public static IReadOnlyDictionary<string, string> Documents { get; } = new Dictionary<string, string>
    {
        ["first_aid_issue_only"] = """First Aid Certificate\nName: Jamie Smith\nCourse: First Aid\nIssued: 05 Jan 2024\n""" ,
        ["first_aid_issue_and_expiry"] = """First Aid Training\nLearner: Jamie Smith\nQualification: First Aid\nIssued on: 05 Jan 2024\nValid until: 05 Jan 2026\n""",
        ["no_dates"] = """Food Hygiene Level 2\nCandidate Name: Alex Chan\nProvider: SafeFood Academy\n""",
        ["handwritten_noise"] = """Manual Handling Certificate\nLearner - Priya Singh\nCourse field scribbled 2023\n""",
        ["low_contrast"] = """Safeguarding Adults\nName: Jordan Lee\nCompleted: 12/03/2023\n"""
    };
}
