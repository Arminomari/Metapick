// ── Auth ────────────────────────────────────────────────
export type UserRole = 'Admin' | 'Brand' | 'Creator';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: string;
  email: string;
  role: UserRole;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  profileName?: string;
  profileStatus?: string;
  lastLoginAt?: string;
  createdAt: string;
  emailVerified: boolean;
}

export interface CreatorProfile {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  category: string;
  country: string;
  language: string;
  avatarUrl?: string;
  /** TikTok followers from the OAuth connection; 0 and tikTokVerified=false for a typed handle. */
  followerCount: number;
  followersSyncedAt?: string | null;
  status: string;
  tikTokConnected: boolean;
  tikTokVerified: boolean;
  tikTokUsername?: string;
  createdAt: string;
  profileTags: string[];
  /** A plain link the creator typed. No Instagram numbers exist anywhere. */
  instagramUsername?: string;
  website?: string;
  openToPrOffers: boolean;
  dateOfBirth?: string | null;
  /** Wide 3:1 banner; a gradient is shown when empty. */
  coverUrl?: string | null;
  /** Opt-in "Instagram kreatör" tag on Hitta and the public profile (a link, never numbers). */
  showInstagramBadge: boolean;
  /** Server rule (CreatorVisibility): approved AND OAuth-connected TikTok. */
  visibleToBrands: boolean;
  /** Why brands cannot see the profile yet; null when visible. */
  visibilityBlocker?: string | null;
}

// ── Portfolio ──────────────────────────────────────────
export type PortfolioMediaType = 'Image' | 'Video' | 'TikTok' | 'Instagram' | 'Link';

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  mediaType: PortfolioMediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  category?: string;
  brandName?: string;
  /** True when linked to a real VYRLE collaboration; otherwise the brand is the creator's own claim. */
  brandVerified: boolean;
  brandProfileId?: string | null;
  campaignId?: string | null;
  ugcCollabId?: string | null;
  /** Present only when the video is one of the creator's own verified campaign videos. */
  verifiedViews?: number | null;
  verifiedLikes?: number | null;
  metricsUpdatedAt?: string | null;
  sortOrder: number;
  isFeatured: boolean;
  createdAt: string;
}

// ── Creator discovery (brand-facing) ───────────────────
export interface CreatorDiscoveryItem {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  category: string;
  country: string;
  language: string;
  avatarUrl?: string;
  tikTokConnected: boolean;
  tikTokVerified: boolean;
  tikTokUsername?: string;
  tikTokFollowerCount: number;
  followersSyncedAt?: string | null;
  instagramUsername?: string;
  profileTags: string[];
  portfolioItemCount: number;
  averageRating: number;
  reviewCount: number;
  completedCampaigns: number;
  openToPrOffers: boolean;
  totalVerifiedViews: number;
  totalEarned: number;
  earningsPerThousandViews: number;
  approvedVideos: number;
  totalVideos: number;
  approvalRate: number;
  metricsUpdatedAt?: string | null;
  lastActiveAt?: string | null;
  verifiedCreator: boolean;
  topCreator: boolean;
  /** Verified views gained in the last 7 / 30 days, from daily TikTok snapshots. */
  views7d: number;
  views30d: number;
  /** The creator's opt-in "Instagram kreatör" tag: a link, never numbers. */
  showInstagramBadge: boolean;
}

export interface CreatorPublicProfile {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  category: string;
  country: string;
  language: string;
  avatarUrl?: string;
  website?: string;
  tikTokConnected: boolean;
  tikTokVerified: boolean;
  tikTokUsername?: string;
  tikTokFollowerCount: number;
  followersSyncedAt?: string | null;
  instagramUsername?: string;
  profileTags: string[];
  openToPrOffers: boolean;
  showInstagramBadge?: boolean;
  portfolio: PortfolioItem[];
  averageRating: number;
  reviewCount: number;
  recentReviews: ReviewDto[];
  completedCampaigns: number;
  createdAt: string;
  /** "Verifierat på VYRLE": every Verified campaign/tap video, all time. */
  totalVerifiedViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
  verifiedPostCount: number;
  metricsUpdatedAt?: string | null;
  totalEarned: number;
  earningsPerThousandViews: number;
  approvedVideos: number;
  totalVideos: number;
  approvalRate: number;
  level: string;
  coverUrl?: string | null;
  /** OAuth TikTok + at least one verified campaign video. */
  verifiedCreator: boolean;
  /** Top decile of verified views among at least ten creators, with at least three verified videos. */
  topCreator: boolean;
}

// ── PR Hub ─────────────────────────────────────────────
export type PrOfferType = 'ProductGifting' | 'Paid' | 'Hybrid' | 'Event';
export type PrOfferStatus = 'Sent' | 'Viewed' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired' | 'Completed';

export interface PrOffer {
  id: string;
  brandProfileId: string;
  brandName: string;
  brandLogoUrl?: string;
  creatorProfileId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  campaignId?: string;
  campaignName?: string;
  title: string;
  message: string;
  offerType: PrOfferType;
  category: string;
  compensationAmount?: number;
  currency: string;
  productDescription?: string;
  productValue?: number;
  deadline?: string;
  status: PrOfferStatus;
  responseMessage?: string;
  createdAssignmentId?: string;
  viewedAt?: string;
  respondedAt?: string;
  createdAt: string;
}

export interface PrCategoryCount {
  category: string;
  count: number;
}

export interface PrOfferStats {
  totalSent: number;
  pending: number;
  viewed: number;
  accepted: number;
  declined: number;
  byCategory: PrCategoryCount[];
}

// ── Campaigns ──────────────────────────────────────────
export interface CampaignListItem {
  id: string;
  name: string;
  category: string;
  country: string;
  status: string;
  budget: number;
  budgetSpent: number;
  maxCreators: number;
  approvedCreatorCount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface CampaignDetail {
  id: string;
  name: string;
  description: string;
  targetAudience?: string;
  country: string;
  region?: string;
  category: string;
  requiredHashtag?: string;
  contentInstructions?: string;
  forbiddenContent?: string;
  minViews: number;
  maxViews?: number;
  payoutModel: string;
  budget: number;
  budgetSpent: number;
  budgetReserved: number;
  maxCreators: number;
  requiredVideoCount: number;
  approvedCreatorCount: number;
  totalViews: number;
  startDate: string;
  endDate: string;
  status: string;
  requirements: CampaignRequirement[];
  rules: CampaignRule[];
  payoutRules: PayoutRule[];
  createdAt: string;
  publishedAt?: string;
  perks?: string;
  contentTags: string[];
}

export interface CampaignBrowseItem {
  id: string;
  name: string;
  brandName: string;
  brandProfileId?: string | null;
  category: string;
  country: string;
  description: string;
  minViews: number;
  payoutModel: string;
  payoutSummary: string;
  maxCreators: number;
  spotsLeft: number;
  startDate: string;
  endDate: string;
  requirements: CampaignRequirement[];
  coverImageUrl?: string;
  perks?: string;
  contentTags: string[];
  payoutRules?: PayoutRule[];
}

export interface CampaignRequirement {
  requirementType: string;
  value: string;
  isRequired: boolean;
}

export interface CampaignRule {
  ruleType: string;
  description: string;
  isMandatory: boolean;
}

export interface PayoutRule {
  payoutType: string;
  minViews: number;
  maxViews?: number;
  amount: number;
  maxPayoutPerCreator?: number;
  sortOrder: number;
  triggerType?: 'Views' | 'Clicks';
  minClicks?: number;
  maxClicks?: number;
}

export interface CreateCampaignRequest {
  name: string;
  description: string;
  targetAudience?: string;
  country: string;
  region?: string;
  category: string;
  requiredHashtag: string;
  contentInstructions?: string;
  forbiddenContent?: string;
  minViews: number;
  maxViews?: number;
  payoutModel: string;
  budget: number;
  maxCreators: number;
  requiredVideoCount: number;
  startDate: string;
  endDate: string;
  reviewMode: string;
  requirements: { requirementType: string; value: string; isRequired: boolean }[];
  rules: { ruleType: string; description: string; isMandatory: boolean }[];
  payoutRules: { payoutType: string; minViews: number; maxViews?: number; amount: number; maxPayoutPerCreator?: number; sortOrder: number; triggerType?: 'Views' | 'Clicks'; minClicks?: number; maxClicks?: number }[];
  perks?: string;
  contentTags: string[];
}

// ── Applications ───────────────────────────────────────
export interface ApplicationItem {
  id: string;
  campaignId: string;
  campaignName: string;
  creatorProfileId: string;
  creatorName: string;
  message?: string;
  status: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  tikTokUsername?: string;
  creatorCategory?: string;
  creatorBio?: string;
  creatorAvatarUrl?: string | null;
  followerCount?: number;
}

// ── Assignments ────────────────────────────────────────
export interface AssignmentListItem {
  id: string;
  campaignId: string;
  campaignName: string;
  status: string;
  totalVerifiedViews: number;
  totalTrackedClicks: number;
  currentPayoutAmount: number;
  assignedAt: string;
  goalReached?: boolean;
  isTap?: boolean;
}

export interface AssignmentDetail {
  id: string;
  campaignId: string;
  campaignName: string;
  creatorProfileId: string;
  creatorName: string;
  status: string;
  totalVerifiedViews: number;
  totalTrackedClicks: number;
  currentPayoutAmount: number;
  trackingTag?: TrackingTag;
  submissions: Submission[];
  socialPosts: SocialPostInfo[];
  assignedAt: string;
  completedAt?: string;
  goalReached?: boolean;
  isTap?: boolean;
  brandUserId: string;
  creatorUserId: string;
  metricsUpdatedAt?: string | null;
}

export interface SocialPostInfo {
  id: string;
  tikTokUrl: string;
  tikTokVideoId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  status: string;
  discoveredAt: string;
  metricsUpdatedAt?: string | null;
}

export interface TrackingTag {
  id: string;
  tagCode: string;
  recommendedHashtag?: string;
  isActive: boolean;
}

export interface Submission {
  id: string;
  assignmentId: string;
  tikTokVideoUrl: string;
  tikTokVideoId?: string;
  notes?: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
}

// ── Payouts ────────────────────────────────────────────
export interface PayoutRequest {
  id: string;
  creatorProfileId: string;
  calculationId: string;
  assignmentId: string;
  campaignId: string;
  campaignName: string;
  amount: number;
  currency: string;
  status: string;
  payoutMethod: string;
  rejectionReason?: string;
  reviewedAt?: string;
  paidAt?: string;
  createdAt: string;
}

export interface PayoutCalculation {
  id: string;
  assignmentId: string;
  verifiedViews: number;
  calculatedAmount: number;
  payoutModel: string;
  ruleSnapshot: string;
  status: string;
  calculatedAt: string;
}

// ── Notifications ──────────────────────────────────────
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  referenceId?: string;
  referenceType?: string | null;
  createdAt: string;
}

// ── Chat ───────────────────────────────────────────────
export interface ChatConversationDto {
  assignmentId: string;
  counterpartName: string;
  counterpartImageUrl?: string | null;
  campaignName: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  counterpartProfileId?: string | null;
  counterpartRole?: 'Creator' | 'Brand' | null;
  threadId: string;
  isDirect?: boolean;
}

// ── Analytics ──────────────────────────────────────────
export interface CampaignAnalytics {
  campaignId: string;
  totalViews: number;
  totalClicks: number;
  totalCreators: number;
  totalPayoutEstimate: number;
  budgetSpent: number;
  budgetRemaining: number;
  creatorPerformance: CreatorPerformance[];
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  views24h: number;
  totalPosts: number;
  verifiedPosts: number;
  metricsUpdatedAt?: string | null;
  calculatedAt?: string | null;
  reviewWindowHours: number;
}

export interface PayoutMethodInfo {
  method: string | null;
  maskedDetails: string | null;
  accountHolder: string | null;
  isConfigured: boolean;
}

export interface SavedCampaignItem {
  campaignId: string;
  savedAt: string;
  campaign: CampaignBrowseItem;
}

export interface MarketBenchmark {
  marketCpm: number;
  totalViews: number;
  totalSpend: number;
  byCategory: NicheBenchmark[];
}

export interface NicheBenchmark {
  category: string;
  cpm: number;
  views: number;
  avgViewsPerCampaign: number;
  campaigns: number;
}

export interface CreatorPerformance {
  assignmentId: string;
  creatorId: string;
  displayName: string;
  views: number;
  clicks: number;
  clickThroughRate: number;
  payoutAmount: number;
  status: string;
  payoutStatus: string;
  paidAt?: string;
  videos: CreatorVideo[];
}

export interface CreatorVideo {
  submissionId?: string;
  videoUrl: string;
  videoId: string | null;
  views: number;
  clicks: number;
  status: string;
  rejectionReason?: string;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  durationSeconds?: number | null;
  publishedAt?: string | null;
  hashtags?: string[];
  /** Counts toward views and payout. */
  verified: boolean;
  metricsUpdatedAt?: string | null;
  /** Set while the brand's decision is pending. */
  autoApproveAt?: string | null;
}

// ── API response wrapper ───────────────────────────────
export interface ApiResponse<T> {
  data: T;
  success: boolean;
}

export interface PagedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface CursorPagedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}

export interface ApiError {
  code: string;
  message: string;
}

// ── Reviews ────────────────────────────────────────────
export interface ReviewDto {
  id: string;
  assignmentId: string;
  reviewerId: string;
  reviewerRole: string;
  reviewerName: string;
  stars: number;
  comment?: string;
  createdAt: string;
}

export interface UserReviewSummary {
  averageStars: number;
  totalReviews: number;
  reviews: ReviewDto[];
}

export interface SubmitReviewRequest {
  stars: number;
  comment?: string;
}

// ── Chat ──────────────────────────────────────────────
export interface ChatMessageDto {
  id: string;
  assignmentId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface SendMessageRequest {
  body: string;
}

// ── Server-computed analytics (see backend AnalyticsDtos.cs) ─────
export interface Insight { kind: 'LowestCpmCampaign' | 'BestDuration' | 'BestDaypart' | string; subject: string; value: number; sampleSize: number; unit: string }
export interface InsightThresholds { minVideosPerBucket: number; minBuckets: number; minCampaignsForCpm: number; minViewsPerCampaignForCpm: number }
export interface BucketRow { key: string; label: string; count: number; views: number; avgViews: number }
export interface HashtagRow { tag: string; count: number; views: number }
export interface CategoryRow { category: string; campaigns: number; views: number; spent: number; cpm?: number | null; engagementRate?: number | null }
export interface BrandCampaignRow { campaignId: string; name: string; category: string; status: string; running: boolean; budget: number; spent: number; remaining: number; views: number; clicks: number; creators: number; verifiedPosts: number; cpm?: number | null; metricsUpdatedAt?: string | null }
export interface BrandCreatorRow { creatorProfileId: string; assignmentId: string; campaignId: string; displayName: string; avatarUrl?: string | null; views: number; payout: number; costPerThousand?: number | null; tikTokVerified: boolean }
export interface BrandVideoRow { campaignId: string; assignmentId: string; creatorName: string; videoUrl: string; views: number; likes: number; comments: number; shares: number; durationSeconds?: number | null; publishedAt?: string | null; metricsUpdatedAt?: string | null }
export interface BrandAnalyticsSummary {
  calculatedAt: string; metricsUpdatedAt?: string | null; scope: string; campaignsInScope: number; runningCampaigns: number;
  totalBudget: number; totalSpent: number; remainingBudget: number;
  totalViews: number; views24h: number; verifiedPosts: number; totalPosts: number; creators: number;
  totalLikes: number; totalComments: number; totalShares: number; totalClicks: number;
  cpm?: number | null; avgViewsPerPost?: number | null; engagementRate?: number | null; shareRate?: number | null; clickThroughRate?: number | null;
  costPerClick?: number | null; costPerEngagement?: number | null; costPerPost?: number | null; costPerShare?: number | null; costPerView?: number | null;
  attentionScore?: number | null; attentionScoreFormula: string; attentionScoreMinPosts: number; attentionScoreMinViews: number;
  videosOver100K: number; videosOver500K: number; videosOver1M: number; viralRate?: number | null;
  campaigns: BrandCampaignRow[]; bestCreators: BrandCreatorRow[]; topContent: BrandVideoRow[]; recentContent: BrandVideoRow[];
  durationBuckets: BucketRow[]; dayparts: BucketRow[]; topHashtags: HashtagRow[]; byCategory: CategoryRow[];
  insights: Insight[]; thresholds: InsightThresholds; lowData: boolean; timezone: string;
}
export interface CreatorCampaignRow { assignmentId: string; campaignId: string; campaignName: string; brandProfileId: string; brandName: string; status: string; isTap: boolean; views: number; clicks: number; earned: number; assignedAt: string; metricsUpdatedAt?: string | null }
export interface CreatorBrandRow { brandProfileId: string; brandName: string; earned: number; views: number }
export interface CreatorLevelTier { index: number; name: string; minPaid: number }
export interface CreatorLevel { index: number; name: string; minPaid: number; totalPaid: number; nextName?: string | null; nextMinPaid?: number | null; progressPercent: number; tiers: CreatorLevelTier[] }
export interface CreatorAnalytics {
  calculatedAt: string; metricsUpdatedAt?: string | null;
  totalVerifiedViews: number; totalClicks: number; clickThroughRate?: number | null; verifiedPosts: number;
  activeAssignments: number; completedAssignments: number; avgViewsPerAssignment?: number | null;
  totalEarned: number; earningsPerThousandViews?: number | null;
  paidOut: number; approved: number; pending: number; accrued: number; availableToWithdraw: number;
  payoutCount: number; avgPayout?: number | null; paidShare?: number | null;
  tapsThisMonth: number; tapsLifetime: number; tapsCount: number;
  prValueDeclared: number;
  level: CreatorLevel;
  tikTokVerified: boolean; tikTokUsername?: string | null; followers: number; followersSyncedAt?: string | null;
  campaigns: CreatorCampaignRow[]; topBrands: CreatorBrandRow[];
  approvedVideos: number; totalVideos: number; approvalRate?: number | null;
  verifiedCreator: boolean; topCreator: boolean;
}
export interface CreatorCollaboration { kind: 'Campaign' | 'Tap' | 'Ugc'; id: string; brandProfileId: string; brandName: string; title: string; status: string; at: string }
export interface UpdateCreatorProfileInput { displayName: string; bio?: string; category: string; country: string; language: string; tikTokUsername?: string; dateOfBirth?: string; profileTags?: string[]; avatarUrl?: string; coverUrl?: string; instagramUsername?: string; website?: string; openToPrOffers?: boolean; showInstagramBadge?: boolean }
export interface PortfolioItemInput { title: string; description?: string; mediaType: PortfolioMediaType; mediaUrl: string; thumbnailUrl?: string; category?: string; brandName?: string; isFeatured: boolean; campaignId?: string | null; ugcCollabId?: string | null; sortOrder?: number }
