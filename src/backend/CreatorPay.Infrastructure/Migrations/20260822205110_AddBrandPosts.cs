using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBrandPosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "brand_posts",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Body = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(400000)", maxLength: 400000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_brand_posts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_brand_posts_brand_profiles_BrandProfileId",
                        column: x => x.BrandProfileId,
                        principalSchema: "public",
                        principalTable: "brand_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_brand_posts_BrandProfileId_CreatedAt",
                schema: "public",
                table: "brand_posts",
                columns: new[] { "BrandProfileId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "brand_posts",
                schema: "public");
        }
    }
}
