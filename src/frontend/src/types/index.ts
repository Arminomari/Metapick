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
  followerCount: number;
  averageViews?: number;
  status: string;
  tikTokConnected: boolean;
  tikTokUsername?: string;
  createdAt: string;
  profileTags: string[];
  instagramUsername?: string;
  instagramFollowerCount: number;
  website?: string;
  openToPrOffers: boolean;
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
  views?: number;
  likes?: number;
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
  followerCount: number;
  averageViews?: number;
  tikTokConnected: boolean;
  tikTokUsername?: string;
  tikTokFollowerCount: number;
  instagramUsername?: string;
  instagramFollowerCount: number;
  profileTags: string[];
  portfolioItemCount: number;
  averageRating: number;
  reviewCount: number;
  completedCampaigns: number;
  openToPrOffers: boolean;
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
  followerCount: number;
  averageViews?: number;
  tikTokConnected: boolean;
  tikTokUsername?: string;
  tikTokFollowerCount: number;
  instagramUsername?: string;
  instagramFollowerCount: number;
  profileTags: string[];
  openToPrOffers: boolean;
  portfolio: PortfolioItem[];
  averageRating: number;
  reviewCount: number;
  recentReviews: ReviewDto[];
  completedCampaigns: number;
  createdAt: string;
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
  brandUserId: string;
  creatorUserId: string;
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
  createdAt: string;
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
