using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPerksTagsAndProfileTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProfileTags",
                schema: "public",
                table: "creator_profiles",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContentTags",
                schema: "public",
                table: "campaigns",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Perks",
                schema: "public",
                table: "campaigns",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProfileTags",
                schema: "public",
                table: "creator_profiles");

            migrationBuilder.DropColumn(
                name: "ContentTags",
                schema: "public",
                table: "campaigns");

            migrationBuilder.DropColumn(
                name: "Perks",
                schema: "public",
                table: "campaigns");
        }
    }
}
