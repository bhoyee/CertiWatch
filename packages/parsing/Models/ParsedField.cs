namespace CertiWatch.Parsing.Models;

public sealed record ParsedField(string Key, string Value, double Confidence, (int Line, int Column)? Position = null);
