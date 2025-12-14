using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSourceSecrets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SourceSecrets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SourceSecrets", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SourceSecrets_SourceId",
                table: "SourceSecrets",
                column: "SourceId");

            migrationBuilder.CreateIndex(
                name: "IX_SourceSecrets_TenantId_SourceId_Key",
                table: "SourceSecrets",
                columns: new[] { "TenantId", "SourceId", "Key" },
                unique: true);

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8117));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8121));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8123));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8124));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8125));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8128));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8129));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8130));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8131));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 1, 18, 470, DateTimeKind.Utc).AddTicks(8132));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SourceSecrets");

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8366));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8372));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8373));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8374));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8375));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8378));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8379));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8380));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8381));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 14, 12, 0, 46, 963, DateTimeKind.Utc).AddTicks(8383));
        }
    }
}
