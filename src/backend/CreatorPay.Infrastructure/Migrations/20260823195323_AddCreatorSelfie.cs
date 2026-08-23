using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatorSelfie : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SelfieUrl",
                schema: "public",
                table: "creator_profiles",
                type: "character varying(400000)",
                maxLength: 400000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SelfieUrl",
                schema: "public",
                table: "creator_profiles");
        }
    }
}
