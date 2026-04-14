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
  payoutRules: { payoutType: string; minViews: number; maxViews?: number; amount: number; maxPayoutPerCreator?: number; sortOrder: number }[];
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
  currentPayoutAmount: number;
  trackingTag?: TrackingTag;
  submissions: Submission[];
  socialPosts: SocialPostInfo[];
  assignedAt: string;
  completedAt?: string;
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
  totalCreators: number;
  totalPayout: number;
  budgetSpent: number;
  budgetRemaining: number;
  creatorPerformance: CreatorPerformance[];
}

export interface CreatorPerformance {
  assignmentId: string;
  creatorId: string;
  displayName: string;
  views: number;
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
  status: string;
  rejectionReason?: string;
  createdAt: string;
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
