using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CertiWatch.Api.Infrastructure.Migrations;

/// <inheritdoc />
public partial class FieldsJsonToText : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "FieldsJson",
            table: "Records",
            type: "text",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "jsonb");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "FieldsJson",
            table: "Records",
            type: "jsonb",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "text");
    }
}
