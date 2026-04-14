using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.CreateTable(
                name: "fraud_flags",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlagType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Evidence = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ResolvedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Resolution = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fraud_flags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    FirstName = table.Column<string>(type: "text", nullable: false),
                    LastName = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EmailVerified = table.Column<bool>(type: "boolean", nullable: false),
                    RefreshTokenHash = table.Column<string>(type: "text", nullable: true),
                    RefreshTokenExpiry = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "admin_profiles",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Department = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PermissionLevel = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_admin_profiles_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "audit_logs",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    OldValues = table.Column<string>(type: "text", nullable: true),
                    NewValues = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_audit_logs_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "brand_profiles",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OrganizationNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Website = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Industry = table.Column<string>(type: "text", nullable: false),
                    Country = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    LogoUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ContactPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_brand_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_brand_profiles_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "creator_profiles",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Bio = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Category = table.Column<string>(type: "text", nullable: false),
                    Country = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    Language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    AvatarUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: true),
                    FollowerCount = table.Column<int>(type: "integer", nullable: false),
                    AverageViews = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    PayoutMethod = table.Column<string>(type: "text", nullable: true),
                    PayoutDetailsEncrypted = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_creator_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_creator_profiles_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ReferenceType = table.Column<string>(type: "text", nullable: true),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_notifications_users_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "brand_wallets",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    TotalDeposited = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    TotalSpent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    TotalReserved = table.Column<decimal>(type: "numeric", nullable: false),
                    Currency = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false, defaultValue: "SEK"),
                    RowVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_brand_wallets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_brand_wallets_brand_profiles_BrandProfileId",
                        column: x => x.BrandProfileId,
                        principalSchema: "public",
                        principalTable: "brand_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "campaigns",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    TargetAudience = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Country = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    Region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RequiredHashtag = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ContentInstructions = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    ForbiddenContent = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    MinViews = table.Column<int>(type: "integer", nullable: false),
                    MaxViews = table.Column<int>(type: "integer", nullable: true),
                    PayoutModel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Budget = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BudgetSpent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    BudgetReserved = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    MaxCreators = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ModerationStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ReviewMode = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CoverImageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RowVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaigns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_campaigns_brand_profiles_BrandProfileId",
                        column: x => x.BrandProfileId,
                        principalSchema: "public",
                        principalTable: "brand_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "tiktok_accounts",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    TikTokUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TikTokUsername = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    FollowerCount = table.Column<int>(type: "integer", nullable: false),
                    AvatarUrl = table.Column<string>(type: "text", nullable: true),
                    AccessTokenEncrypted = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    RefreshTokenEncrypted = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    TokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Scopes = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ConnectedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSyncAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tiktok_accounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tiktok_accounts_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "campaign_applications",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaign_applications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_campaign_applications_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_campaign_applications_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "campaign_requirements",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequirementType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaign_requirements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_campaign_requirements_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "campaign_rules",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    RuleType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    IsMandatory = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_campaign_rules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_campaign_rules_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payout_rules",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayoutType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MinViews = table.Column<long>(type: "bigint", nullable: false),
                    MaxViews = table.Column<long>(type: "bigint", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "text", nullable: false),
                    MaxPayoutPerCreator = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payout_rules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payout_rules_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "creator_campaign_assignments",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ReservedBudget = table.Column<decimal>(type: "numeric", nullable: false),
                    TotalVerifiedViews = table.Column<long>(type: "bigint", nullable: false),
                    CurrentPayoutAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RowVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_creator_campaign_assignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_creator_campaign_assignments_campaign_applications_Applicat~",
                        column: x => x.ApplicationId,
                        principalSchema: "public",
                        principalTable: "campaign_applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_creator_campaign_assignments_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_creator_campaign_assignments_creator_profiles_CreatorProfil~",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "creator_submissions",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TikTokVideoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    TikTokVideoId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_creator_submissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_creator_submissions_creator_campaign_assignments_Assignment~",
                        column: x => x.AssignmentId,
                        principalSchema: "public",
                        principalTable: "creator_campaign_assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "disputes",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    InitiatedById = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Resolution = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ResolvedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_disputes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_disputes_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_disputes_creator_campaign_assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalSchema: "public",
                        principalTable: "creator_campaign_assignments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_disputes_users_InitiatedById",
                        column: x => x.InitiatedById,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payout_calculations",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CalculatedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    VerifiedViews = table.Column<long>(type: "bigint", nullable: false),
                    PayoutRuleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CalculationDetails = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IsLatest = table.Column<bool>(type: "boolean", nullable: false),
                    CalculatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    OverriddenAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    OverrideReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payout_calculations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payout_calculations_creator_campaign_assignments_Assignment~",
                        column: x => x.AssignmentId,
                        principalSchema: "public",
                        principalTable: "creator_campaign_assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payout_calculations_payout_rules_PayoutRuleId",
                        column: x => x.PayoutRuleId,
                        principalSchema: "public",
                        principalTable: "payout_rules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tracking_tags",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TagCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RecommendedHashtag = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tracking_tags", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tracking_tags_creator_campaign_assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalSchema: "public",
                        principalTable: "creator_campaign_assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "social_posts",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmissionId = table.Column<Guid>(type: "uuid", nullable: true),
                    TikTokVideoId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TikTokUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Caption = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Duration = table.Column<int>(type: "integer", nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MatchConfidence = table.Column<decimal>(type: "numeric", nullable: false),
                    MatchDetails = table.Column<string>(type: "text", nullable: true),
                    VerificationStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    LatestViewCount = table.Column<long>(type: "bigint", nullable: false),
                    LatestLikeCount = table.Column<long>(type: "bigint", nullable: false),
                    LatestCommentCount = table.Column<long>(type: "bigint", nullable: false),
                    LatestShareCount = table.Column<long>(type: "bigint", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    DiscoveredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_social_posts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_social_posts_creator_campaign_assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalSchema: "public",
                        principalTable: "creator_campaign_assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_social_posts_creator_submissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalSchema: "public",
                        principalTable: "creator_submissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payout_requests",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayoutCalculationId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false, defaultValue: "SEK"),
                    PayoutMethod = table.Column<string>(type: "text", nullable: false),
                    PayoutDetailsEncrypted = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReviewedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payout_requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payout_requests_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payout_requests_payout_calculations_PayoutCalculationId",
                        column: x => x.PayoutCalculationId,
                        principalSchema: "public",
                        principalTable: "payout_calculations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "social_post_metric_snapshots",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SocialPostId = table.Column<Guid>(type: "uuid", nullable: false),
                    ViewCount = table.Column<long>(type: "bigint", nullable: false),
                    LikeCount = table.Column<long>(type: "bigint", nullable: false),
                    CommentCount = table.Column<long>(type: "bigint", nullable: false),
                    ShareCount = table.Column<long>(type: "bigint", nullable: false),
                    SnapshotDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Source = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_social_post_metric_snapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_social_post_metric_snapshots_social_posts_SocialPostId",
                        column: x => x.SocialPostId,
                        principalSchema: "public",
                        principalTable: "social_posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "view_verification_records",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SocialPostId = table.Column<Guid>(type: "uuid", nullable: false),
                    VerifiedViewCount = table.Column<long>(type: "bigint", nullable: false),
                    PeakViewCount = table.Column<long>(type: "bigint", nullable: false),
                    VerificationMethod = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ConfidenceScore = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    Flags = table.Column<string>(type: "text", nullable: true),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VerifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_view_verification_records", x => x.Id);
                    table.ForeignKey(
                        name: "FK_view_verification_records_social_posts_SocialPostId",
                        column: x => x.SocialPostId,
                        principalSchema: "public",
                        principalTable: "social_posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payout_transactions",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PayoutRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalTransactionId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    Provider = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FailureReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    InitiatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payout_transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payout_transactions_payout_requests_PayoutRequestId",
                        column: x => x.PayoutRequestId,
                        principalSchema: "public",
                        principalTable: "payout_requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_profiles_UserId",
                schema: "public",
                table: "admin_profiles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_CreatedAt",
                schema: "public",
                table: "audit_logs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_EntityType_EntityId",
                schema: "public",
                table: "audit_logs",
                columns: new[] { "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_UserId",
                schema: "public",
                table: "audit_logs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_brand_profiles_UserId",
                schema: "public",
                table: "brand_profiles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_brand_wallets_BrandProfileId",
                schema: "public",
                table: "brand_wallets",
                column: "BrandProfileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_campaign_applications_CampaignId_CreatorProfileId",
                schema: "public",
                table: "campaign_applications",
                columns: new[] { "CampaignId", "CreatorProfileId" });

            migrationBuilder.CreateIndex(
                name: "IX_campaign_applications_CreatorProfileId",
                schema: "public",
                table: "campaign_applications",
                column: "CreatorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_applications_Status",
                schema: "public",
                table: "campaign_applications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_requirements_CampaignId",
                schema: "public",
                table: "campaign_requirements",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_campaign_rules_CampaignId",
                schema: "public",
                table: "campaign_rules",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_BrandProfileId",
                schema: "public",
                table: "campaigns",
                column: "BrandProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_Status",
                schema: "public",
                table: "campaigns",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_campaigns_Status_EndDate",
                schema: "public",
                table: "campaigns",
                columns: new[] { "Status", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_creator_campaign_assignments_ApplicationId",
                schema: "public",
                table: "creator_campaign_assignments",
                column: "ApplicationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_creator_campaign_assignments_CampaignId_CreatorProfileId",
                schema: "public",
                table: "creator_campaign_assignments",
                columns: new[] { "CampaignId", "CreatorProfileId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_creator_campaign_assignments_CreatorProfileId",
                schema: "public",
                table: "creator_campaign_assignments",
                column: "CreatorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_creator_campaign_assignments_Status",
                schema: "public",
                table: "creator_campaign_assignments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_creator_profiles_UserId",
                schema: "public",
                table: "creator_profiles",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_creator_submissions_AssignmentId",
                schema: "public",
                table: "creator_submissions",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_creator_submissions_TikTokVideoId",
                schema: "public",
                table: "creator_submissions",
                column: "TikTokVideoId");

            migrationBuilder.CreateIndex(
                name: "IX_disputes_AssignmentId",
                schema: "public",
                table: "disputes",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_disputes_CampaignId",
                schema: "public",
                table: "disputes",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_disputes_InitiatedById",
                schema: "public",
                table: "disputes",
                column: "InitiatedById");

            migrationBuilder.CreateIndex(
                name: "IX_disputes_Status",
                schema: "public",
                table: "disputes",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_fraud_flags_EntityType_EntityId",
                schema: "public",
                table: "fraud_flags",
                columns: new[] { "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_fraud_flags_Status",
                schema: "public",
                table: "fraud_flags",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_CreatedAt",
                schema: "public",
                table: "notifications",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_UserId_IsRead",
                schema: "public",
                table: "notifications",
                columns: new[] { "UserId", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_payout_calculations_AssignmentId",
                schema: "public",
                table: "payout_calculations",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_payout_calculations_PayoutRuleId",
                schema: "public",
                table: "payout_calculations",
                column: "PayoutRuleId");

            migrationBuilder.CreateIndex(
                name: "IX_payout_requests_CreatorProfileId",
                schema: "public",
                table: "payout_requests",
                column: "CreatorProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_payout_requests_PayoutCalculationId",
                schema: "public",
                table: "payout_requests",
                column: "PayoutCalculationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payout_requests_Status",
                schema: "public",
                table: "payout_requests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_payout_rules_CampaignId",
                schema: "public",
                table: "payout_rules",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_payout_transactions_PayoutRequestId",
                schema: "public",
                table: "payout_transactions",
                column: "PayoutRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_social_post_metric_snapshots_SocialPostId_SnapshotDate",
                schema: "public",
                table: "social_post_metric_snapshots",
                columns: new[] { "SocialPostId", "SnapshotDate" });

            migrationBuilder.CreateIndex(
                name: "IX_social_posts_AssignmentId",
                schema: "public",
                table: "social_posts",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_social_posts_SubmissionId",
                schema: "public",
                table: "social_posts",
                column: "SubmissionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_social_posts_TikTokVideoId",
                schema: "public",
                table: "social_posts",
                column: "TikTokVideoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_accounts_CreatorProfileId",
                schema: "public",
                table: "tiktok_accounts",
                column: "CreatorProfileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tiktok_accounts_TikTokUsername",
                schema: "public",
                table: "tiktok_accounts",
                column: "TikTokUsername",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tracking_tags_AssignmentId",
                schema: "public",
                table: "tracking_tags",
                column: "AssignmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tracking_tags_TagCode",
                schema: "public",
                table: "tracking_tags",
                column: "TagCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                schema: "public",
                table: "users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_view_verification_records_SocialPostId",
                schema: "public",
                table: "view_verification_records",
                column: "SocialPostId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_profiles",
                schema: "public");

            migrationBuilder.DropTable(
                name: "audit_logs",
                schema: "public");

            migrationBuilder.DropTable(
                name: "brand_wallets",
                schema: "public");

            migrationBuilder.DropTable(
                name: "campaign_requirements",
                schema: "public");

            migrationBuilder.DropTable(
                name: "campaign_rules",
                schema: "public");

            migrationBuilder.DropTable(
                name: "disputes",
                schema: "public");

            migrationBuilder.DropTable(
                name: "fraud_flags",
                schema: "public");

            migrationBuilder.DropTable(
                name: "notifications",
                schema: "public");

            migrationBuilder.DropTable(
                name: "payout_transactions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "social_post_metric_snapshots",
                schema: "public");

            migrationBuilder.DropTable(
                name: "tiktok_accounts",
                schema: "public");

            migrationBuilder.DropTable(
                name: "tracking_tags",
                schema: "public");

            migrationBuilder.DropTable(
                name: "view_verification_records",
                schema: "public");

            migrationBuilder.DropTable(
                name: "payout_requests",
                schema: "public");

            migrationBuilder.DropTable(
                name: "social_posts",
                schema: "public");

            migrationBuilder.DropTable(
                name: "payout_calculations",
                schema: "public");

            migrationBuilder.DropTable(
                name: "creator_submissions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "payout_rules",
                schema: "public");

            migrationBuilder.DropTable(
                name: "creator_campaign_assignments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "campaign_applications",
                schema: "public");

            migrationBuilder.DropTable(
                name: "campaigns",
                schema: "public");

            migrationBuilder.DropTable(
                name: "creator_profiles",
                schema: "public");

            migrationBuilder.DropTable(
                name: "brand_profiles",
                schema: "public");

            migrationBuilder.DropTable(
                name: "users",
                schema: "public");
        }
    }
}
