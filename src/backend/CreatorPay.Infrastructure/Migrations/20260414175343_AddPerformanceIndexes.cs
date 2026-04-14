using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Users � email lookup (login) + status filter (admin pending list)
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_users_email ON users (\"Email\");");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_users_status ON users (\"Status\") WHERE \"IsDeleted\" = false;");

            // Campaigns � hot query paths: brand list, public browse, sync job
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_campaigns_brand_status ON campaigns (\"BrandProfileId\", \"Status\") WHERE \"IsDeleted\" = false;");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_campaigns_status_dates ON campaigns (\"Status\", \"StartDate\", \"EndDate\") WHERE \"IsDeleted\" = false;");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_campaigns_category_country ON campaigns (\"Category\", \"Country\") WHERE \"IsDeleted\" = false AND \"Status\" = 'Active';");

            // Assignments � creator dashboard, sync job
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_assignments_creator_status ON creator_campaign_assignments (\"CreatorProfileId\", \"Status\");");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_assignments_campaign_status ON creator_campaign_assignments (\"CampaignId\", \"Status\");");

            // Applications � brand review, creator history
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_applications_campaign_status ON campaign_applications (\"CampaignId\", \"Status\");");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_applications_creator_status ON campaign_applications (\"CreatorProfileId\", \"Status\");");

            // SocialPosts � sync job critical path
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_socialposts_assignment_active ON social_posts (\"AssignmentId\") WHERE \"IsActive\" = true;");
            migrationBuilder.Sql("CREATE UNIQUE INDEX IF NOT EXISTS ix_socialposts_tiktok_video_id ON social_posts (\"TikTokVideoId\");");

            // PayoutRequests � creator payout list, admin settlement
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_payoutrequests_creator_status ON payout_requests (\"CreatorProfileId\", \"Status\");");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_payoutrequests_status_created ON payout_requests (\"Status\", \"CreatedAt\");");

            // Notifications � unread notification queries
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_notifications_user_unread ON notifications (\"UserId\", \"IsRead\", \"CreatedAt\" DESC) WHERE \"IsRead\" = false;");

            // AuditLogs � admin audit trail queries
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_auditlogs_entity ON audit_logs (\"EntityType\", \"EntityId\", \"CreatedAt\" DESC);");

            // FraudFlags � fraud review queries
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_fraudflags_status ON fraud_flags (\"Status\", \"CreatedAt\" DESC);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_users_email;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_users_status;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_campaigns_brand_status;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_campaigns_status_dates;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_campaigns_category_country;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_assignments_creator_status;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_assignments_campaign_status;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_applications_campaign_status;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_applications_creator_status;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_socialposts_assignment_active;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_socialposts_tiktok_video_id;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_payoutrequests_creator_status;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_payoutrequests_status_created;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_notifications_user_unread;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_auditlogs_entity;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_fraudflags_status;");
        }
    }
}
