using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SupportTicketNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TicketId",
                table: "Notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlatformNotifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TicketId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformNotifications", x => x.Id);
                });

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

            migrationBuilder.CreateIndex(
                name: "IX_PlatformNotifications_IsRead_CreatedAt",
                table: "PlatformNotifications",
                columns: new[] { "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformNotifications_TicketId",
                table: "PlatformNotifications",
                column: "TicketId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlatformNotifications");

            migrationBuilder.DropColumn(
                name: "TicketId",
                table: "Notifications");

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6134));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6141));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6143));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6145));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6146));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6149));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6151));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6153));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6154));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6158));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000101"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6295));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000102"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6303));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000103"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6305));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000104"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6307));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000105"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6309));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000106"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6312));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000107"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6314));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000108"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6315));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000109"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6317));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000110"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6319));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000111"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6321));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000112"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6322));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000113"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6324));

            migrationBuilder.UpdateData(
                table: "RequirementTypes",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000114"),
                column: "CreatedAt",
                value: new DateTime(2026, 9, 14, 8, 25, 4, 275, DateTimeKind.Utc).AddTicks(6325));
        }
    }
}
