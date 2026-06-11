using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSocialAuthAndInlineMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AuthProvider",
                schema: "public",
                table: "users",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalAuthId",
                schema: "public",
                table: "users",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "AvatarUrl",
                schema: "public",
                table: "creator_profiles",
                type: "character varying(400000)",
                maxLength: 400000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "LogoUrl",
                schema: "public",
                table: "brand_profiles",
                type: "character varying(400000)",
                maxLength: 400000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_AuthProvider_ExternalAuthId",
                schema: "public",
                table: "users",
                columns: new[] { "AuthProvider", "ExternalAuthId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_AuthProvider_ExternalAuthId",
                schema: "public",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AuthProvider",
                schema: "public",
                table: "users");

            migrationBuilder.DropColumn(
                name: "ExternalAuthId",
                schema: "public",
                table: "users");

            migrationBuilder.AlterColumn<string>(
                name: "AvatarUrl",
                schema: "public",
                table: "creator_profiles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(400000)",
                oldMaxLength: 400000,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "LogoUrl",
                schema: "public",
                table: "brand_profiles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(400000)",
                oldMaxLength: 400000,
                oldNullable: true);
        }
    }
}
