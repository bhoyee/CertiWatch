namespace CertiWatch.Contracts.Rules;

public enum RulePrecedence
{
    CompanyExact = 100,
    CompanyVendorOverride = 90,
    CompanyRegex = 80,
    GlobalExact = 70,
    GlobalVendorOverride = 60,
    GlobalRegex = 50,
    Tag = 40,
    CompanyDefault = 30,
    Fallback = 10
}
