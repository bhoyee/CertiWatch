using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantReminderLeadDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReminderLeadDaysCsv",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2060));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2068));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2070));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2072));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2073));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2077));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2079));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2080));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2082));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2084));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000101"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2229));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000102"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2234));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000103"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2237));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000104"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2251));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000105"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2253));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000106"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2256));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000107"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2258));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000108"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2259));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000109"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2261));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000110"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2264));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000111"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2265));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000112"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2267));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000113"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2268));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000114"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 8, 53, 30, 137, DateTimeKind.Utc).AddTicks(2270));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReminderLeadDaysCsv",
                table: "Tenants");

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(665));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(671));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(672));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(673));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(675));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(677));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(678));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(679));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(680));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(683));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000101"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(781));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000102"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(784));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000103"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(786));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000104"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(788));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000105"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(789));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000106"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(791));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000107"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(793));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000108"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(794));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000109"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(795));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000110"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(797));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000111"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(799));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000112"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(800));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000113"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(801));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000114"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 11, 11, 59, 329, DateTimeKind.Utc).AddTicks(803));
        }
    }
}
