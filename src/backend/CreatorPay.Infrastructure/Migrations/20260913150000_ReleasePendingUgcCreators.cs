using CreatorPay.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations;

/// <summary>
/// The sample-video / follower gate is gone: creators are Verified from the
/// start and the Stripe onboarding is the real verification. Pending rows
/// created under the old rule were waiting for that filter, not for an admin.
/// Data-only — the model is unchanged.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260913150000_ReleasePendingUgcCreators")]
public class ReleasePendingUgcCreators : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""UPDATE public.ugc_creator_profiles SET "Status" = 'Verified' WHERE "Status" = 'Pending' AND "ReviewedAt" IS NULL;""");
    }

    protected override void Down(MigrationBuilder migrationBuilder) { }
}
