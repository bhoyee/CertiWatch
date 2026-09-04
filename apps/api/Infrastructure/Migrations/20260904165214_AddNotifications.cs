using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecordId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4222));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4229));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4230));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4231));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4233));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4235));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4237));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4239));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4240));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4242));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000101"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4367));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000102"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4371));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000103"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4373));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000104"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4375));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000105"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4376));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000106"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4379));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000107"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4380));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000108"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4382));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000109"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4383));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000110"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4384));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000111"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4386));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000112"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4396));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000113"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4398));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000114"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 4, 16, 52, 14, 207, DateTimeKind.Utc).AddTicks(4399));

            migrationBuilder.CreateIndex(
                name: "idx_notifications_record_type",
                table: "Notifications",
                columns: new[] { "RecordId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_TenantId_IsRead_CreatedAt",
                table: "Notifications",
                columns: new[] { "TenantId", "IsRead", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2447));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2456));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2458));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2459));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2461));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2464));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2466));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2467));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2469));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2472));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000101"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2640));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000102"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2645));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000103"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2647));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000104"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2649));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000105"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2651));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000106"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2654));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000107"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2656));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000108"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2657));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000109"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2658));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000110"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2661));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000111"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2662));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000112"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2664));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000113"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2665));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000114"),
                column: "CreatedAt",
                value: new DateTime(2026, 8, 7, 19, 47, 18, 769, DateTimeKind.Utc).AddTicks(2674));
        }
    }
}
