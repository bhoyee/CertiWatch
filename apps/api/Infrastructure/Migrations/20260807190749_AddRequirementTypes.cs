using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace CertiWatch.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRequirementTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RequirementTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    DefaultValidityMonths = table.Column<int>(type: "integer", nullable: true),
                    IsRenewable = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequirementTypes", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3957));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3964));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3966));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3968));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3969));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3974));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3975));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3977));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3978));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(3980));

            migrationBuilder.InsertData(
                table: "RequirementTypes",
                columns: new[] { "Id", "CreatedAt", "DefaultValidityMonths", "IsRenewable", "Name", "TenantId" },
                values: new object[,]
                {
                    { new Guid("00000000-0000-0000-0000-000000000101"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4110), 12, true, "DBS Check", null },
                    { new Guid("00000000-0000-0000-0000-000000000102"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4115), null, false, "Care Certificate", null },
                    { new Guid("00000000-0000-0000-0000-000000000103"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4117), 24, true, "Safeguarding", null },
                    { new Guid("00000000-0000-0000-0000-000000000104"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4119), 12, true, "Moving & Handling", null },
                    { new Guid("00000000-0000-0000-0000-000000000105"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4121), 12, true, "Medication Competency", null },
                    { new Guid("00000000-0000-0000-0000-000000000106"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4123), 12, true, "Fire Safety", null },
                    { new Guid("00000000-0000-0000-0000-000000000107"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4124), 36, true, "First Aid", null },
                    { new Guid("00000000-0000-0000-0000-000000000108"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4126), 12, true, "Infection Control", null },
                    { new Guid("00000000-0000-0000-0000-000000000109"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4127), 36, true, "Food Hygiene", null },
                    { new Guid("00000000-0000-0000-0000-000000000110"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4129), null, false, "Right to Work", null },
                    { new Guid("00000000-0000-0000-0000-000000000111"), new DateTime(2026, 8, 7, 19, 7, 49, 35, DateTimeKind.Utc).AddTicks(4131), 12, true, "NMC Registration", null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_RequirementTypes_TenantId_Name",
                table: "RequirementTypes",
                columns: new[] { "TenantId", "Name" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RequirementTypes");

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6517));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6529));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6531));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6533));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6536));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6541));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6543));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6545));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6547));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 16, 52, 28, 203, DateTimeKind.Utc).AddTicks(6551));
        }
    }
}
