using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BlockA_DataIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Likes",
                schema: "public",
                table: "portfolio_items");

            migrationBuilder.DropColumn(
                name: "Views",
                schema: "public",
                table: "portfolio_items");

            migrationBuilder.DropColumn(
                name: "AverageViews",
                schema: "public",
                table: "creator_profiles");

            migrationBuilder.DropColumn(
                name: "InstagramFollowerCount",
                schema: "public",
                table: "creator_profiles");

            migrationBuilder.AddColumn<DateTime>(
                name: "MetricsUpdatedAt",
                schema: "public",
                table: "social_posts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BrandProfileId",
                schema: "public",
                table: "portfolio_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CampaignId",
                schema: "public",
                table: "portfolio_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UgcCollabId",
                schema: "public",
                table: "portfolio_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OrgVerificationCheckedAt",
                schema: "public",
                table: "brand_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrgVerificationSource",
                schema: "public",
                table: "brand_profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OrgVerified",
                schema: "public",
                table: "brand_profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "OrgVerifiedAt",
                schema: "public",
                table: "brand_profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrgVerifiedName",
                schema: "public",
                table: "brand_profiles",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MetricsUpdatedAt",
                schema: "public",
                table: "social_posts");

            migrationBuilder.DropColumn(
                name: "BrandProfileId",
                schema: "public",
                table: "portfolio_items");

            migrationBuilder.DropColumn(
                name: "CampaignId",
                schema: "public",
                table: "portfolio_items");

            migrationBuilder.DropColumn(
                name: "UgcCollabId",
                schema: "public",
                table: "portfolio_items");

            migrationBuilder.DropColumn(
                name: "OrgVerificationCheckedAt",
                schema: "public",
                table: "brand_profiles");

            migrationBuilder.DropColumn(
                name: "OrgVerificationSource",
                schema: "public",
                table: "brand_profiles");

            migrationBuilder.DropColumn(
                name: "OrgVerified",
                schema: "public",
                table: "brand_profiles");

            migrationBuilder.DropColumn(
                name: "OrgVerifiedAt",
                schema: "public",
                table: "brand_profiles");

            migrationBuilder.DropColumn(
                name: "OrgVerifiedName",
                schema: "public",
                table: "brand_profiles");

            migrationBuilder.AddColumn<long>(
                name: "Likes",
                schema: "public",
                table: "portfolio_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Views",
                schema: "public",
                table: "portfolio_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AverageViews",
                schema: "public",
                table: "creator_profiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InstagramFollowerCount",
                schema: "public",
                table: "creator_profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
