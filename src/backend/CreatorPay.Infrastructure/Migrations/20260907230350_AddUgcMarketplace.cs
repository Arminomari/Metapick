using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUgcMarketplace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ugc_campaigns",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BrandProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Goal = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Format = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LengthSeconds = table.Column<int>(type: "integer", nullable: false),
                    VideoCount = table.Column<int>(type: "integer", nullable: false),
                    Hooks = table.Column<string>(type: "text", nullable: false),
                    CallToAction = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ReferenceUrls = table.Column<string>(type: "text", nullable: false),
                    Dos = table.Column<string>(type: "text", nullable: false),
                    Donts = table.Column<string>(type: "text", nullable: false),
                    ExtraNotes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    BriefGeneratedByAi = table.Column<bool>(type: "boolean", nullable: false),
                    Region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Categories = table.Column<string>(type: "text", nullable: false),
                    MinFollowers = table.Column<int>(type: "integer", nullable: true),
                    MaxFollowers = table.Column<int>(type: "integer", nullable: true),
                    Compensation = table.Column<string>(type: "text", nullable: false),
                    BudgetMinOre = table.Column<long>(type: "bigint", nullable: false),
                    BudgetMaxOre = table.Column<long>(type: "bigint", nullable: false),
                    ProductDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ProductValueOre = table.Column<long>(type: "bigint", nullable: true),
                    RightsPackage = table.Column<string>(type: "text", nullable: false),
                    DeadlineDays = table.Column<int>(type: "integer", nullable: false),
                    Slots = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_campaigns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_campaigns_brand_profiles_BrandProfileId",
                        column: x => x.BrandProfileId,
                        principalSchema: "public",
                        principalTable: "brand_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ugc_creator_profiles",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    StatusNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ReviewedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Strikes = table.Column<int>(type: "integer", nullable: false),
                    SuspendedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Categories = table.Column<string>(type: "text", nullable: false),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Languages = table.Column<string>(type: "text", nullable: false),
                    SampleVideoUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    FollowerSnapshot = table.Column<int>(type: "integer", nullable: false),
                    LikeFollowerRatio = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: false),
                    SocialSnapshotAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveredCount = table.Column<int>(type: "integer", nullable: false),
                    OnTimeCount = table.Column<int>(type: "integer", nullable: false),
                    LateCount = table.Column<int>(type: "integer", nullable: false),
                    AverageRating = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: false),
                    RatingCount = table.Column<int>(type: "integer", nullable: false),
                    StripeConnectAccountId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PayoutOnboardingComplete = table.Column<bool>(type: "boolean", nullable: false),
                    HasFTax = table.Column<bool>(type: "boolean", nullable: false),
                    VatRegistered = table.Column<bool>(type: "boolean", nullable: false),
                    VatNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    AllowPortfolioUse = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_creator_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_creator_profiles_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ugc_webhook_events",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    EventId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    EventType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_webhook_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ugc_applications",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    BidOre = table.Column<long>(type: "bigint", nullable: false),
                    Pitch = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecisionNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_applications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_applications_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ugc_applications_ugc_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "ugc_campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ugc_collabs",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: true),
                    BrandProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BriefSnapshot = table.Column<string>(type: "text", nullable: false),
                    Compensation = table.Column<string>(type: "text", nullable: false),
                    AgreedAmountOre = table.Column<long>(type: "bigint", nullable: false),
                    PlatformFeeOre = table.Column<long>(type: "bigint", nullable: false),
                    BrandTotalOre = table.Column<long>(type: "bigint", nullable: false),
                    FeePercentApplied = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    ProductDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ProductValueOre = table.Column<long>(type: "bigint", nullable: true),
                    RightsPackage = table.Column<string>(type: "text", nullable: false),
                    DeadlineDays = table.Column<int>(type: "integer", nullable: false),
                    DeadlineAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AutoApproveAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    NoShow = table.Column<bool>(type: "boolean", nullable: false),
                    ContractText = table.Column<string>(type: "text", nullable: false),
                    ContractHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ContractTemplateVersion = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    BrandAcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatorAcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    RevisionCount = table.Column<int>(type: "integer", nullable: false),
                    MaxRevisions = table.Column<int>(type: "integer", nullable: false),
                    DeadlineReminder48hSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeadlineReminder24hSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AutoApproveReminderSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LicenseDocumentUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    BrandRating = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_collabs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_collabs_brand_profiles_BrandProfileId",
                        column: x => x.BrandProfileId,
                        principalSchema: "public",
                        principalTable: "brand_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ugc_collabs_creator_profiles_CreatorProfileId",
                        column: x => x.CreatorProfileId,
                        principalSchema: "public",
                        principalTable: "creator_profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ugc_collabs_ugc_applications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalSchema: "public",
                        principalTable: "ugc_applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ugc_collabs_ugc_campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "public",
                        principalTable: "ugc_campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ugc_collab_events",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CollabId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromStatus = table.Column<int>(type: "integer", nullable: true),
                    ToStatus = table.Column<string>(type: "text", nullable: false),
                    Actor = table.Column<string>(type: "text", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_collab_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_collab_events_ugc_collabs_CollabId",
                        column: x => x.CollabId,
                        principalSchema: "public",
                        principalTable: "ugc_collabs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ugc_deliverables",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CollabId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    FileUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    FileKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: true),
                    CreatorComment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    BrandFeedback = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    FeedbackAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_deliverables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_deliverables_ugc_collabs_CollabId",
                        column: x => x.CollabId,
                        principalSchema: "public",
                        principalTable: "ugc_collabs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ugc_disputes",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CollabId = table.Column<Guid>(type: "uuid", nullable: false),
                    OpenedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OpenedBy = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Decision = table.Column<int>(type: "integer", nullable: true),
                    CreatorSharePercent = table.Column<int>(type: "integer", nullable: true),
                    AdminReasoning = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ResolvedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_disputes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_disputes_ugc_collabs_CollabId",
                        column: x => x.CollabId,
                        principalSchema: "public",
                        principalTable: "ugc_collabs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ugc_messages",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CollabId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderRole = table.Column<string>(type: "text", nullable: false),
                    Body = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    AttachmentUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_messages_ugc_collabs_CollabId",
                        column: x => x.CollabId,
                        principalSchema: "public",
                        principalTable: "ugc_collabs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ugc_payments",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CollabId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    PaymentIntentId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ChargeId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TransferId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RefundId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    BrandPaidOre = table.Column<long>(type: "bigint", nullable: false),
                    CreatorAmountOre = table.Column<long>(type: "bigint", nullable: false),
                    PlatformFeeOre = table.Column<long>(type: "bigint", nullable: false),
                    TransferredOre = table.Column<long>(type: "bigint", nullable: false),
                    RefundedOre = table.Column<long>(type: "bigint", nullable: false),
                    HeldAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TransferredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RefundedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ugc_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ugc_payments_ugc_collabs_CollabId",
                        column: x => x.CollabId,
                        principalSchema: "public",
                        principalTable: "ugc_collabs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_applications_CampaignId_CreatorProfileId",
                schema: "public",
                table: "ugc_applications",
                columns: new[] { "CampaignId", "CreatorProfileId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ugc_applications_CreatorProfileId_Status",
                schema: "public",
                table: "ugc_applications",
                columns: new[] { "CreatorProfileId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_campaigns_BrandProfileId_Status",
                schema: "public",
                table: "ugc_campaigns",
                columns: new[] { "BrandProfileId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_campaigns_Status_PublishedAt",
                schema: "public",
                table: "ugc_campaigns",
                columns: new[] { "Status", "PublishedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collab_events_CollabId_CreatedAt",
                schema: "public",
                table: "ugc_collab_events",
                columns: new[] { "CollabId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collabs_ApplicationId",
                schema: "public",
                table: "ugc_collabs",
                column: "ApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collabs_BrandProfileId_Status",
                schema: "public",
                table: "ugc_collabs",
                columns: new[] { "BrandProfileId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collabs_CampaignId",
                schema: "public",
                table: "ugc_collabs",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collabs_CreatorProfileId_Status",
                schema: "public",
                table: "ugc_collabs",
                columns: new[] { "CreatorProfileId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collabs_Status_AutoApproveAt",
                schema: "public",
                table: "ugc_collabs",
                columns: new[] { "Status", "AutoApproveAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_collabs_Status_DeadlineAt",
                schema: "public",
                table: "ugc_collabs",
                columns: new[] { "Status", "DeadlineAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_creator_profiles_CreatorProfileId",
                schema: "public",
                table: "ugc_creator_profiles",
                column: "CreatorProfileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ugc_creator_profiles_Status",
                schema: "public",
                table: "ugc_creator_profiles",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ugc_deliverables_CollabId_Version",
                schema: "public",
                table: "ugc_deliverables",
                columns: new[] { "CollabId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ugc_disputes_CollabId",
                schema: "public",
                table: "ugc_disputes",
                column: "CollabId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ugc_disputes_Status",
                schema: "public",
                table: "ugc_disputes",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ugc_messages_CollabId_CreatedAt",
                schema: "public",
                table: "ugc_messages",
                columns: new[] { "CollabId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ugc_payments_CollabId",
                schema: "public",
                table: "ugc_payments",
                column: "CollabId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ugc_payments_PaymentIntentId",
                schema: "public",
                table: "ugc_payments",
                column: "PaymentIntentId");

            migrationBuilder.CreateIndex(
                name: "IX_ugc_webhook_events_Provider_EventId",
                schema: "public",
                table: "ugc_webhook_events",
                columns: new[] { "Provider", "EventId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ugc_collab_events",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_creator_profiles",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_deliverables",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_disputes",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_messages",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_payments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_webhook_events",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_collabs",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_applications",
                schema: "public");

            migrationBuilder.DropTable(
                name: "ugc_campaigns",
                schema: "public");
        }
    }
}
