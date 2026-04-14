using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoReviewAndMultiVideo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                schema: "public",
                table: "creator_submissions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                schema: "public",
                table: "creator_submissions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedBy",
                schema: "public",
                table: "creator_submissions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RequiredVideoCount",
                schema: "public",
                table: "campaigns",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RejectionReason",
                schema: "public",
                table: "creator_submissions");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                schema: "public",
                table: "creator_submissions");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                schema: "public",
                table: "creator_submissions");

            migrationBuilder.DropColumn(
                name: "RequiredVideoCount",
                schema: "public",
                table: "campaigns");
        }
    }
}
