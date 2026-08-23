using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTapAndCommunity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BriefUpdatedAt",
                schema: "public",
                table: "campaigns",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                schema: "public",
                table: "campaigns",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyBudget",
                schema: "public",
                table: "campaigns",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyCapPerCreator",
                schema: "public",
                table: "campaigns",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PayoutCapPerVideo",
                schema: "public",
                table: "campaigns",
                type: "numeric",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "brand_community_members",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Source = table.Column<string>(type: "text", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_brand_community_members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_brand_community_members_brand_profiles_BrandProfileId",
                        column: x => x.BrandProfileId,
                        principalSchema: "public",
                        principalTable: "brand_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_brand_community_members_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tap_accruals",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    Views = table.Column<long>(type: "bigint", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tap_accruals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tap_accruals_creator_campaign_assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalSchema: "public",
                        principalTable: "creator_campaign_assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_brand_community_members_BrandProfileId_CreatorProfileId",
                schema: "public",
                table: "brand_community_members",
                columns: new[] { "BrandProfileId", "CreatorProfileId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_brand_community_members_CreatorProfileId",
                schema: "public",
                table: "brand_community_members",
                column: "CreatorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_tap_accruals_AssignmentId_Year_Month",
                schema: "public",
                table: "tap_accruals",
                columns: new[] { "AssignmentId", "Year", "Month" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "brand_community_members",
                schema: "public");

            migrationBuilder.DropTable(
                name: "tap_accruals",
                schema: "public");

            migrationBuilder.DropColumn(
                name: "BriefUpdatedAt",
                schema: "public",
                table: "campaigns");

            migrationBuilder.DropColumn(
                name: "Kind",
                schema: "public",
                table: "campaigns");

            migrationBuilder.DropColumn(
                name: "MonthlyBudget",
                schema: "public",
                table: "campaigns");

            migrationBuilder.DropColumn(
                name: "MonthlyCapPerCreator",
                schema: "public",
                table: "campaigns");

            migrationBuilder.DropColumn(
                name: "PayoutCapPerVideo",
                schema: "public",
                table: "campaigns");
        }
    }
}
