using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BlockB_Profiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CoverUrl",
                schema: "public",
                table: "creator_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverUrl",
                schema: "public",
                table: "brand_profiles",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CoverUrl",
                schema: "public",
                table: "creator_profiles");

            migrationBuilder.DropColumn(
                name: "CoverUrl",
                schema: "public",
                table: "brand_profiles");
        }
    }
}
