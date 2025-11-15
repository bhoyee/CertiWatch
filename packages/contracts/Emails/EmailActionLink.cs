namespace CertiWatch.Contracts.Emails;

public sealed record EmailActionLink(
    string Label,
    Uri Url,
    string? Description = null
);
