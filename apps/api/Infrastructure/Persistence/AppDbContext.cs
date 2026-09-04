using CertiWatch.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Source> Sources => Set<Source>();
    public DbSet<SourceSecret> SourceSecrets => Set<SourceSecret>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<Record> Records => Set<Record>();
    public DbSet<CourseRule> CourseRules => Set<CourseRule>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Reminder> Reminders => Set<Reminder>();
    public DbSet<BillingInvoice> BillingInvoices => Set<BillingInvoice>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<UploadRequest> UploadRequests => Set<UploadRequest>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportMessage> SupportMessages => Set<SupportMessage>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<DeviceEnrollmentCode> DeviceEnrollmentCodes => Set<DeviceEnrollmentCode>();
    public DbSet<StaffMember> StaffMembers => Set<StaffMember>();
    public DbSet<RequirementType> RequirementTypes => Set<RequirementType>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.Entity<Record>(entity =>
        {
            entity.HasIndex(r => r.ExpiryDate);
            entity.HasIndex(r => r.StaffName).HasMethod("gin").HasOperators("gin_trgm_ops");
            entity.HasIndex(r => r.CourseName).HasMethod("gin").HasOperators("gin_trgm_ops");
            entity.HasIndex(r => r.CreatedByUserId);
            // Keep FieldsJson as text to tolerate legacy malformed payloads that would otherwise break jsonb parsing.
            entity.Property(r => r.FieldsJson).HasColumnType("text");
            entity.HasOne(r => r.Document).WithMany(d => d.Records).HasForeignKey(r => r.DocumentId);
        });

        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasIndex(d => new { d.ProcessingStatus, d.CreatedAt }).HasDatabaseName("idx_documents_status_created");
            entity.HasIndex(d => d.CreatedByUserId);
        });

        modelBuilder.Entity<Vendor>(entity =>
        {
            entity.Property(v => v.HintsJson).HasColumnType("jsonb");
            entity.Property(v => v.PatternsJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasIndex(n => new { n.TenantId, n.IsRead, n.CreatedAt });
            entity.HasIndex(n => new { n.RecordId, n.Type }).HasDatabaseName("idx_notifications_record_type");
        });

        modelBuilder.Entity<Reminder>(entity =>
        {
            entity.HasOne(r => r.Record).WithMany(r => r.Reminders).HasForeignKey(r => r.RecordId);
        });

        modelBuilder.Entity<BillingInvoice>(entity =>
        {
            entity.HasIndex(i => new { i.TenantId, i.StripeInvoiceId }).IsUnique();
        });

        modelBuilder.Entity<CourseRule>(entity =>
        {
            entity.HasIndex(r => new { r.TenantId, r.CourseName }).IsUnique(false);
        });

        modelBuilder.Entity<RequirementType>(entity =>
        {
            entity.HasIndex(r => new { r.TenantId, r.Name }).IsUnique(false);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.Property(a => a.MetaJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<Source>(entity =>
        {
            entity.Property(s => s.ConfigJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<SourceSecret>(entity =>
        {
            entity.HasIndex(s => new { s.TenantId, s.SourceId, s.Key }).IsUnique();
        });

        modelBuilder.Entity<UploadRequest>(entity =>
        {
            entity.HasIndex(u => new { u.TenantId, u.Token }).IsUnique();
            entity.HasIndex(u => u.CreatedByUserId);
        });

        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.HasIndex(t => new { t.TenantId, t.Status });
            entity.HasIndex(t => t.CreatedByUserId);
            entity.HasIndex(t => t.AssignedToUserId);
            entity.Property(t => t.Subject).HasMaxLength(256);
            entity.Property(t => t.Body).HasColumnType("text");
            entity.Property(t => t.AssignedRole).HasMaxLength(32);
            entity.Property(t => t.Status).HasMaxLength(32);
            entity.Property(t => t.Priority).HasMaxLength(32);
            entity.HasMany(t => t.Messages)
                .WithOne(m => m.Ticket!)
                .HasForeignKey(m => m.TicketId);
        });

        modelBuilder.Entity<SupportMessage>(entity =>
        {
            entity.HasIndex(m => m.AuthorUserId);
            entity.Property(m => m.Body).HasColumnType("text");
        });

        modelBuilder.Entity<ApiKey>(entity =>
        {
            entity.HasIndex(k => new { k.TenantId, k.IsRevoked });
            entity.HasIndex(k => k.Key).IsUnique();
            entity.Property(k => k.Key).HasMaxLength(256);
            entity.Property(k => k.Name).HasMaxLength(128);
        });

        modelBuilder.Entity<DeviceEnrollmentCode>(entity =>
        {
            entity.HasIndex(c => c.CodeHash).IsUnique();
            entity.HasIndex(c => new { c.TenantId, c.RevokedAt, c.ExpiresAt });
            entity.Property(c => c.CodeHash).HasMaxLength(128);
        });

        SeedGlobalRules(modelBuilder);
        SeedGlobalRequirementTypes(modelBuilder);
    }

    private static void SeedGlobalRules(ModelBuilder modelBuilder)
    {
        var seeds = new (Guid Id, string Course, int Months, bool Renewable)[]
        {
            (Guid.Parse("00000000-0000-0000-0000-000000000001"), "First Aid", 36, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000002"), "Fire Safety", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000003"), "Food Hygiene Level 2", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000004"), "Manual Handling", 24, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000005"), "Safeguarding Adults", 24, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000006"), "GDPR Awareness", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000007"), "Infection Control", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000008"), "Health and Safety Induction", 36, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000009"), "Equality and Diversity", 36, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000010"), "COSHH Awareness", 12, true)
        };

        modelBuilder.Entity<CourseRule>().HasData(seeds.Select(seed => new CourseRule
        {
            Id = seed.Id,
            TenantId = null,
            CourseName = seed.Course,
            DefaultValidityMonths = seed.Months,
            IsRenewable = seed.Renewable,
            CreatedAt = DateTime.UtcNow
        }));
    }

    // The staff compliance checklist catalog - what every care worker in the UK sector is
    // typically required to hold. Separate ID range (...0101-...0111) from SeedGlobalRules'
    // (...0001-...0010) so the two seeded tables never collide.
    private static void SeedGlobalRequirementTypes(ModelBuilder modelBuilder)
    {
        var seeds = new (Guid Id, string Name, int? Months, bool Renewable)[]
        {
            (Guid.Parse("00000000-0000-0000-0000-000000000101"), "DBS Check", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000102"), "Care Certificate", null, false),
            (Guid.Parse("00000000-0000-0000-0000-000000000103"), "Safeguarding", 24, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000104"), "Moving & Handling", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000105"), "Medication Competency", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000106"), "Fire Safety", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000107"), "First Aid", 36, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000108"), "Infection Control", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000109"), "Food Hygiene", 36, true),
            // Not a fixed cadence like the others - a British/settled-status worker's right to
            // work never expires, but a visa holder's does, on whatever date their own visa
            // says. No universal DefaultValidityMonths applies; IsRenewable=true so the
            // (future) compliance matrix checks each person's actual extracted expiry date
            // instead of treating this as permanently satisfied once uploaded.
            (Guid.Parse("00000000-0000-0000-0000-000000000110"), "Right to Work", null, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000111"), "NMC Registration", 12, true),
            (Guid.Parse("00000000-0000-0000-0000-000000000112"), "NVQ Level 2 in Health & Social Care", null, false),
            (Guid.Parse("00000000-0000-0000-0000-000000000113"), "NVQ Level 3 in Health & Social Care", null, false),
            (Guid.Parse("00000000-0000-0000-0000-000000000114"), "NVQ Level 4 in Health & Social Care", null, false)
        };

        modelBuilder.Entity<RequirementType>().HasData(seeds.Select(seed => new RequirementType
        {
            Id = seed.Id,
            TenantId = null,
            Name = seed.Name,
            DefaultValidityMonths = seed.Months,
            IsRenewable = seed.Renewable,
            CreatedAt = DateTime.UtcNow
        }));
    }
}
