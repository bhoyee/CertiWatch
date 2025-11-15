namespace CertiWatch.Parsing.Vendors;

public static class VendorProfileStore
{
    public static IReadOnlyList<VendorProfile> Profiles { get; } = new List<VendorProfile>
    {
        new() { Name = "SafeWork Training", Hints = new[] {"safework", "@safework"}, Patterns = new Dictionary<string, string>{{"footer", "safework"}} },
        new() { Name = "RescueOne", Hints = new[] {"rescueone"}, Patterns = new Dictionary<string, string>{{"domain", "rescueone"}} },
        new() { Name = "Cloud Compliance", Hints = new[] {"cloudcompliance"}, Patterns = new Dictionary<string, string>{{"phone", "0800"}} },
        new() { Name = "Brightline", Hints = new[] {"brightline"}, Patterns = new Dictionary<string, string>{{"address", "Brightline"}} },
        new() { Name = "FirstAidCo", Hints = new[] {"firstaidco"}, Patterns = new Dictionary<string, string>{{"email", "firstaid"}} },
        new() { Name = "SafetyLab", Hints = new[] {"safetylab"}, Patterns = new Dictionary<string, string>{{"site", "safetylab"}} },
        new() { Name = "HygieneHub", Hints = new[] {"hygienehub"}, Patterns = new Dictionary<string, string>{{"brand", "Hygiene Hub"}} },
        new() { Name = "Guardian Skills", Hints = new[] {"guardian"}, Patterns = new Dictionary<string, string>{{"domain", "guardian"}} },
        new() { Name = "Northwind Training", Hints = new[] {"northwind"}, Patterns = new Dictionary<string, string>{{"footer", "Northwind"}} },
        new() { Name = "Atlas Health", Hints = new[] {"atlashealth"}, Patterns = new Dictionary<string, string>{{"email", "atlas"}} }
    };
}
