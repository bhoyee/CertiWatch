using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSharedWithAllManagers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Hand-edited from the scaffolded `defaultValue: false` - every existing Source/Device
            // was necessarily admin-connected (the only path that exists today), so this backfills
            // them all as shared with every manager rather than leaving them stuck unscoped-off
            // until an admin happens to notice and toggle each one manually. New rows going
            // forward get `true` from the Source/Device C# property initializer regardless of
            // this column-level default (which only governs backfill + raw-SQL inserts).
            migrationBuilder.AddColumn<bool>(
                name: "SharedWithAllManagers",
                table: "Sources",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "SharedWithAllManagers",
                table: "Devices",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(2983));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(2992));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(2993));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(2994));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(2996));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(2998));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(2999));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3001));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3010));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3013));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000101"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3136));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000102"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3140));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000103"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3141));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000104"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3158));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000105"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3159));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000106"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3162));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000107"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3163));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000108"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3165));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000109"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3166));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000110"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3168));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000111"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3169));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000112"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3170));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000113"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3172));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000114"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 18, 20, 57, 26, 171, DateTimeKind.Utc).AddTicks(3173));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SharedWithAllManagers",
                table: "Sources");

            migrationBuilder.DropColumn(
                name: "SharedWithAllManagers",
                table: "Devices");

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
    }
}
