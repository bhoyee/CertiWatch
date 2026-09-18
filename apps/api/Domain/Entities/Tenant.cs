namespace CertiWatch.Api.Domain.Entities;

public sealed class Tenant : BaseEntity
{
    public required string Name { get; set; }
    public string Plan { get; set; } = "standard";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? SubscriptionStatus { get; set; }
    public DateTime? CurrentPeriodEndUtc { get; set; }
    public DateTime? CancelAtUtc { get; set; }
    public string? BillingEmail { get; set; }
    // Comma-separated days-before-expiry (e.g. "60,30,7,1"). Null/empty means "use the global
    // ReminderOptions.LeadDays default" - most tenants never need to touch this, so there's no
    // row to backfill for existing tenants, just an absence of an override.
    public string? ReminderLeadDaysCsv { get; set; }
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<CourseRule> Rules { get; set; } = new List<CourseRule>();
}
