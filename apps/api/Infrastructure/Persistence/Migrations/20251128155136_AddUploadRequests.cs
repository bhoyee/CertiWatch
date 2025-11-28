using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUploadRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UploadRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "text", nullable: false),
                    StaffName = table.Column<string>(type: "text", nullable: true),
                    StaffEmail = table.Column<string>(type: "text", nullable: true),
                    CourseName = table.Column<string>(type: "text", nullable: true),
                    ExpiryHint = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    FilePath = table.Column<string>(type: "text", nullable: true),
                    OriginalFileName = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UploadRequests", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6806));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6812));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6813));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6814));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6815));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6819));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6820));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6821));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6822));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 28, 15, 51, 36, 354, DateTimeKind.Utc).AddTicks(6824));

            migrationBuilder.CreateIndex(
                name: "IX_UploadRequests_TenantId_Token",
                table: "UploadRequests",
                columns: new[] { "TenantId", "Token" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UploadRequests");

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8319));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8349));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8356));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8363));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8369));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8385));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8392));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8399));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8406));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2025, 11, 16, 13, 38, 5, 152, DateTimeKind.Utc).AddTicks(8419));
        }
    }
}
