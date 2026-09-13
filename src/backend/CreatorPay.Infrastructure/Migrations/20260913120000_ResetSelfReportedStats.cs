using CreatorPay.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations;

/// <summary>
/// Self-reported reach numbers are gone. Followers now follow the connected
/// TikTok account (0 when none is linked with OAuth); average views and
/// Instagram followers have no fetched source yet, so they are cleared.
/// Data-only — the model is unchanged, so no snapshot edit is needed.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260913120000_ResetSelfReportedStats")]
public class ResetSelfReportedStats : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE public.creator_profiles cp SET
                "FollowerCount" = COALESCE((
                    SELECT t."FollowerCount" FROM public.tiktok_accounts t
                    WHERE t."CreatorProfileId" = cp."Id" AND t."IsActive" AND t."Scopes" <> 'manual'
                    ORDER BY t."ConnectedAt" DESC LIMIT 1), 0),
                "AverageViews" = NULL,
                "InstagramFollowerCount" = 0;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // The self-reported values are intentionally not restorable.
    }
}
