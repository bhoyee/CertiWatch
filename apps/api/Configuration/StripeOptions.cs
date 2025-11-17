namespace CertiWatch.Api.Configuration;

public sealed class StripePlanOption
{
    public string PlanId { get; init; } = string.Empty;
    public string PriceId { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public int RecordLimit { get; init; }
}

public sealed class StripeOptions
{
    public string SecretKey { get; init; } = string.Empty;
    public string PublishableKey { get; init; } = string.Empty;
    public string WebhookSecret { get; init; } = string.Empty;
    public string SuccessUrl { get; init; } = "https://app.certiwatch.com/signup/success";
    public string CancelUrl { get; init; } = "https://app.certiwatch.com/signup";
    public int TrialDays { get; init; } = 14;
    public IReadOnlyList<StripePlanOption> Plans { get; init; } = Array.Empty<StripePlanOption>();
}
