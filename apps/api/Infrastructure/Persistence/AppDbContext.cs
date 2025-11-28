using CertiWatch.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Source> Sources => Set<Source>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<Record> Records => Set<Record>();
    public DbSet<CourseRule> CourseRules => Set<CourseRule>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Reminder> Reminders => Set<Reminder>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<UploadRequest> UploadRequests => Set<UploadRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.Entity<Record>(entity =>
        {
            entity.HasIndex(r => r.ExpiryDate);
            entity.HasIndex(r => r.StaffName).HasMethod("gin").HasOperators("gin_trgm_ops");
            entity.HasIndex(r => r.CourseName).HasMethod("gin").HasOperators("gin_trgm_ops");
            entity.Property(r => r.FieldsJson).HasColumnType("jsonb");
            entity.HasOne(r => r.Document).WithMany(d => d.Records).HasForeignKey(r => r.DocumentId);
        });

        modelBuilder.Entity<Document>(entity =>
        {
            entity.HasIndex(d => new { d.ProcessingStatus, d.CreatedAt }).HasDatabaseName("idx_documents_status_created");
        });

        modelBuilder.Entity<Vendor>(entity =>
        {
            entity.Property(v => v.HintsJson).HasColumnType("jsonb");
            entity.Property(v => v.PatternsJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<Reminder>(entity =>
        {
            entity.HasOne(r => r.Record).WithMany(r => r.Reminders).HasForeignKey(r => r.RecordId);
        });

        modelBuilder.Entity<CourseRule>(entity =>
        {
            entity.HasIndex(r => new { r.TenantId, r.CourseName }).IsUnique(false);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.Property(a => a.MetaJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<Source>(entity =>
        {
            entity.Property(s => s.ConfigJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<UploadRequest>(entity =>
        {
            entity.HasIndex(u => new { u.TenantId, u.Token }).IsUnique();
        });

        SeedGlobalRules(modelBuilder);
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
}
