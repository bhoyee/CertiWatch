namespace CertiWatch.Api.Domain.Entities;

public sealed class BillingInvoice : BaseEntity
{
    public Guid TenantId { get; set; }
    public required string StripeInvoiceId { get; set; }
    public string? Currency { get; set; }
    public long AmountDue { get; set; }
    public long AmountPaid { get; set; }
    public string Status { get; set; } = "unknown";
    public string? HostedInvoiceUrl { get; set; }
    public string? PdfUrl { get; set; }
    public DateTime? PeriodStartUtc { get; set; }
    public DateTime? PeriodEndUtc { get; set; }
    public DateTime? InvoiceDateUtc { get; set; }
}
