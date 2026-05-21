using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPortfolioInstagramAndPrOffers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InstagramFollowerCount",
                schema: "public",
                table: "creator_profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "InstagramUsername",
                schema: "public",
                table: "creator_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OpenToPrOffers",
                schema: "public",
                table: "creator_profiles",
                type: "boolean",
                nullable: false,
                // Existing creators are open to PR offers by default so the PR Hub has reach.
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Website",
                schema: "public",
                table: "creator_profiles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "portfolio_items",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    MediaType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MediaUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ThumbnailUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    BrandName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Views = table.Column<long>(type: "bigint", nullable: true),
                    Likes = table.Column<long>(type: "bigint", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsFeatured = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_portfolio_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_portfolio_items_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pr_offers",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    OfferType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CompensationAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Currency = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    ProductDescription = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ProductValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Deadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ResponseMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ViewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAssignmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pr_offers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pr_offers_brand_profiles_BrandProfileId",
                        column: x => x.BrandProfileId,
                        principalSchema: "public",
                        principalTable: "brand_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pr_offers_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_pr_offers_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_creator_profiles_Status_Category",
                schema: "public",
                table: "creator_profiles",
                columns: new[] { "Status", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_portfolio_items_CreatorProfileId_SortOrder",
                schema: "public",
                table: "portfolio_items",
                columns: new[] { "CreatorProfileId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_pr_offers_BrandProfileId_Status",
                schema: "public",
                table: "pr_offers",
                columns: new[] { "BrandProfileId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_pr_offers_CampaignId",
                schema: "public",
                table: "pr_offers",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_pr_offers_Category",
                schema: "public",
                table: "pr_offers",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_pr_offers_CreatorProfileId_Status",
                schema: "public",
                table: "pr_offers",
                columns: new[] { "CreatorProfileId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "portfolio_items",
                schema: "public");

            migrationBuilder.DropTable(
                name: "pr_offers",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_creator_profiles_Status_Category",
                schema: "public",
                table: "creator_profiles");

            migrationBuilder.DropColumn(
                name: "InstagramFollowerCount",
                schema: "public",
                table: "creator_profiles");

            migrationBuilder.DropColumn(
                name: "InstagramUsername",
                schema: "public",
                table: "creator_profiles");

            migrationBuilder.DropColumn(
                name: "OpenToPrOffers",
                schema: "public",
                table: "creator_profiles");

            migrationBuilder.DropColumn(
                name: "Website",
                schema: "public",
                table: "creator_profiles");
        }
    }
}
