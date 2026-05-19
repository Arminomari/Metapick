using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackingLinksAndClickTriggers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "MaxClicks",
                schema: "public",
                table: "payout_rules",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "MinClicks",
                schema: "public",
                table: "payout_rules",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "TriggerType",
                schema: "public",
                table: "payout_rules",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Views");

            migrationBuilder.CreateTable(
                name: "tracking_links",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TargetUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    TotalClicks = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tracking_links", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tracking_links_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_tracking_links_creator_campaign_assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalSchema: "public",
                        principalTable: "creator_campaign_assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tracking_links_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "link_tracking_clicks",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackingLinkId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClickedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Referrer = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    IpHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_link_tracking_clicks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_link_tracking_clicks_tracking_links_TrackingLinkId",
                        column: x => x.TrackingLinkId,
                        principalSchema: "public",
                        principalTable: "tracking_links",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_link_tracking_clicks_TrackingLinkId_ClickedAt",
                schema: "public",
                table: "link_tracking_clicks",
                columns: new[] { "TrackingLinkId", "ClickedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_tracking_links_AssignmentId",
                schema: "public",
                table: "tracking_links",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_tracking_links_CampaignId_CreatorProfileId",
                schema: "public",
                table: "tracking_links",
                columns: new[] { "CampaignId", "CreatorProfileId" });

            migrationBuilder.CreateIndex(
                name: "IX_tracking_links_Code",
                schema: "public",
                table: "tracking_links",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tracking_links_CreatorProfileId",
                schema: "public",
                table: "tracking_links",
                column: "CreatorProfileId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "link_tracking_clicks",
                schema: "public");

            migrationBuilder.DropTable(
                name: "tracking_links",
                schema: "public");

            migrationBuilder.DropColumn(
                name: "MaxClicks",
                schema: "public",
                table: "payout_rules");

            migrationBuilder.DropColumn(
                name: "MinClicks",
                schema: "public",
                table: "payout_rules");

            migrationBuilder.DropColumn(
                name: "TriggerType",
                schema: "public",
                table: "payout_rules");
        }
    }
}
