using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUgcEventSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ugc_collab_events_CollabId_CreatedAt",
                schema: "public",
                table: "ugc_collab_events");

            migrationBuilder.AddColumn<long>(
                name: "Sequence",
                schema: "public",
                table: "ugc_collab_events",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collab_events_CollabId_Sequence",
                schema: "public",
                table: "ugc_collab_events",
                columns: new[] { "CollabId", "Sequence" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ugc_collab_events_CollabId_Sequence",
                schema: "public",
                table: "ugc_collab_events");

            migrationBuilder.DropColumn(
                name: "Sequence",
                schema: "public",
                table: "ugc_collab_events");

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collab_events_CollabId_CreatedAt",
                schema: "public",
                table: "ugc_collab_events",
                columns: new[] { "CollabId", "CreatedAt" });
        }
    }
}
