using CreatorPay.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations;

/// <summary>
/// Portfolio views/likes were typed in by the creator and shown next to
/// "verified views". They are no longer accepted; clear what was stored.
/// Data-only — the model is unchanged.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260917100000_ClearSelfReportedPortfolioStats")]
public class ClearSelfReportedPortfolioStats : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""UPDATE public.portfolio_items SET "Views" = NULL, "Likes" = NULL WHERE "Views" IS NOT NULL OR "Likes" IS NOT NULL;""");
    }

    protected override void Down(MigrationBuilder migrationBuilder) { }
}
