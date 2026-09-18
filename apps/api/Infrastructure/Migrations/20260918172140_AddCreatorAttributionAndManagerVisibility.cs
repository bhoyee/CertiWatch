using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatorAttributionAndManagerVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ManagerSeesAllRecords",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "Sources",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "Devices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "DeviceEnrollmentCodes",
                type: "uuid",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5265));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5272));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5274));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5275));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5277));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5279));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5281));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5282));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5284));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5287));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000101"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5436));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000102"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5440));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000103"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5442));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000104"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5444));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000105"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5446));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000106"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5448));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000107"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5450));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000108"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5452));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000109"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5453));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000110"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5456));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000111"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5457));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000112"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5459));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000113"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5461));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000114"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 17, 21, 39, 567, DateTimeKind.Utc).AddTicks(5462));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManagerSeesAllRecords",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Sources");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "DeviceEnrollmentCodes");

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8181));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8188));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8190));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8192));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8193));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8196));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8198));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8200));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8201));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8204));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000101"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8343));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000102"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8349));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000103"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8351));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000104"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8363));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000105"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8365));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000106"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8368));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000107"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8369));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000108"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8371));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000109"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8372));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000110"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8374));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000111"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8376));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000112"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8377));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000113"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8379));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000114"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 12, 50, 54, 880, DateTimeKind.Utc).AddTicks(8380));
        }
    }
}
