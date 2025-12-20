using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatorFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "InvitedByUserId",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "UploadRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "Records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "Documents",
                type: "uuid",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5461));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5467));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5468));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5469));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5470));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5473));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5474));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5475));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5476));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 20, 7, 59, 56, 818, DateTimeKind.Utc).AddTicks(5478));

            migrationBuilder.CreateIndex(
                name: "IX_UploadRequests_CreatedByUserId",
                table: "UploadRequests",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Records_CreatedByUserId",
                table: "Records",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_CreatedByUserId",
                table: "Documents",
                column: "CreatedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UploadRequests_CreatedByUserId",
                table: "UploadRequests");

            migrationBuilder.DropIndex(
                name: "IX_Records_CreatedByUserId",
                table: "Records");

            migrationBuilder.DropIndex(
                name: "IX_Documents_CreatedByUserId",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "InvitedByUserId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "UploadRequests");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Records");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Documents");

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(6908));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(6946));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(6954));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000004"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(6960));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000005"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(6966));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000006"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(6991));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000007"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(6998));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000008"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(7003));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000009"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(7008));

            migrationBuilder.UpdateData(
                table: "CourseRules",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000010"),
                column: "CreatedAt",
                value: new DateTime(2025, 12, 15, 14, 18, 20, 167, DateTimeKind.Utc).AddTicks(7018));
        }
    }
}
