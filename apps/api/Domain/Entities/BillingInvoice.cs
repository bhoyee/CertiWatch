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
    // Our own archived copy of the PDF (downloaded from PdfUrl the moment the invoice is
    // finalized) - Stripe's hosted links are the system of record while they're alive, but they
    // can go stale (voided invoice, test-mode data cleared, etc.); this is the durable fallback
    // so a tenant's invoice history never depends on Stripe's link still being valid later.
    public string? ArchivedPdfPath { get; set; }
    public DateTime? PeriodStartUtc { get; set; }
    public DateTime? PeriodEndUtc { get; set; }
    public DateTime? InvoiceDateUtc { get; set; }
}
