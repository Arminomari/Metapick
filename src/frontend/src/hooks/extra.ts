/**
 * Queries that used to live inline in page components. Same endpoints, same
 * query keys, so cache invalidation from the existing mutations still works.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, ReviewDto } from '@/types';

/* Communities and taps (creator) */
export interface MyCommunity { brandProfileId: string; brandName: string; brandLogoUrl?: string | null; source: string; joinedAt: string; hasActiveTap: boolean; status?: string }
const fetchCommunities = async () => (await api.get<ApiResponse<MyCommunity[]>>('/creator/communities')).data.data;
export const useMyCommunities = () => useQuery({ queryKey: ['my-communities'], queryFn: fetchCommunities, select: (rows) => rows.filter((r) => (r.status ?? 'Active') === 'Active'), refetchInterval: 120000 });
export const usePendingCommunityInvites = () => useQuery({ queryKey: ['my-communities'], queryFn: fetchCommunities, select: (rows) => rows.filter((r) => r.status === 'Invited'), refetchInterval: 120000 });
export const usePendingCommunityRequests = () => useQuery({ queryKey: ['my-communities'], queryFn: fetchCommunities, select: (rows) => rows.filter((r) => r.status === 'Requested'), refetchInterval: 120000 });

export interface CreatorTap {
  tapId: string; assignmentId: string; brandProfileId: string; brandName: string; brandLogoUrl?: string | null;
  name: string; tapStatus: string; membershipStatus: string;
  brief: string; contentInstructions?: string | null; requiredHashtag: string;
  cpm: number; payoutCapPerVideo?: number | null; monthlyCapPerCreator?: number | null;
  myMonthEarned: number; myMonthViews: number; myLifetimeEarned: number;
  tapMonthBudget: number; tapMonthSpent: number; briefUpdatedAt?: string | null;
  tapMonthUsedPercent: number; calculatedAt?: string | null;
}
export const useCreatorTaps = () => useQuery({ queryKey: ['creator-taps'], queryFn: async () => (await api.get<ApiResponse<CreatorTap[]>>('/creator/taps')).data.data, refetchInterval: 60000 });

/* Taps (brand) */
export interface TapDto {
  id: string; name: string; status: string; monthlyBudget: number; cpm: number;
  payoutCapPerVideo?: number | null; monthlyCapPerCreator?: number | null;
  brief: string; contentInstructions?: string | null; requiredHashtag: string; category: string;
  monthSpent: number; monthRemaining: number; monthViews: number; activeCreatorsThisMonth: number;
  memberCount: number; briefUpdatedAt?: string | null; createdAt: string;
  monthUsedPercent: number; calculatedAt?: string | null;
}
export const useBrandTaps = () => useQuery({ queryKey: ['brand-taps'], queryFn: async () => (await api.get<ApiResponse<TapDto[]>>('/brand/tap/all')).data.data });

export interface Payable {
  assignmentId: string; calculationId: string; campaignName: string; isTap: boolean;
  earned: number; alreadyClaimed: number; available: number; hasPendingRequest: boolean;
  verifiedViews: number; calculatedAt: string;
}
export const usePayables = () => useQuery({
  queryKey: ['payables'],
  queryFn: async () => (await api.get<ApiResponse<Payable[]>>('/payouts/payable')).data.data,
  refetchInterval: 60000,
});
export function useRequestPayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calculationId: string) => (await api.post('/payouts/request', { calculationId })).data.data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payables'] }); qc.invalidateQueries({ queryKey: ['creator-payouts'] }); },
  });
}

export interface FeedPost { id: string; body: string; imageUrl?: string | null; createdAt: string; brandProfileId: string; brandName: string; brandLogoUrl?: string | null }
export const useBrandFeed = () => useQuery({
  queryKey: ['brand-feed'],
  queryFn: async () => (await api.get<ApiResponse<FeedPost[]>>('/brands/feed')).data.data,
  refetchInterval: 60000,
});

export interface BrandPublicCampaign { id: string; name: string; category: string; status: string; payoutSummary: string; startDate: string; endDate: string; spotsLeft: number; totalViews: number }
export interface BrandPost { id: string; body: string; imageUrl?: string | null; createdAt: string }
export interface BrandPublicProfile {
  brandProfileId: string; companyName: string; logoUrl?: string | null; industry: string; country: string;
  description?: string | null; website?: string | null; memberSince: string;
  followerCount: number; isFollowing: boolean;
  activeCampaignCount: number; completedCampaignCount: number; totalVerifiedViews: number; creatorsWorkedWith: number;
  averageRating: number; reviewCount: number; recentReviews: ReviewDto[];
  activeCampaigns: BrandPublicCampaign[]; pastCampaigns: BrandPublicCampaign[];
  posts?: BrandPost[] | null;
  hasTap?: boolean; tapCpm?: number; tapName?: string | null; tapBrief?: string | null;
  tapHashtag?: string | null; tapCapPerVideo?: number | null; tapMonthlyCapPerCreator?: number | null;
  membershipStatus?: string | null;
  /** Registry-verified organisation number — never inferred from the number being present. */
  orgVerified: boolean;
  metricsUpdatedAt?: string | null;
  taps?: { id: string; name: string; cpm: number; brief: string; requiredHashtag: string; capPerVideo?: number | null; monthlyCapPerCreator?: number | null; category: string }[] | null;
}
export const useBrandPublicProfile = (id?: string) => useQuery({
  queryKey: ['brand-public', id],
  queryFn: async () => (await api.get<ApiResponse<BrandPublicProfile>>(`/brands/${id}/public`)).data.data,
  enabled: !!id,
});

export interface CommunityMember {
  creatorProfileId: string; displayName: string; avatarUrl?: string | null; tikTokUsername?: string | null; tikTokFollowers: number;
  status: string; source: string; joinedAt: string; lifetimeEarned: number; lifetimeViews: number; collaborations: number;
  tikTokVerified: boolean; followersSyncedAt?: string | null;
}
export const useCommunityMembers = () => useQuery({
  queryKey: ['brand-community'],
  queryFn: async () => (await api.get<ApiResponse<CommunityMember[]>>('/brand/community/members')).data.data,
});

export interface TapSubmission {
  submissionId: string; assignmentId: string; creatorName: string; creatorAvatarUrl?: string | null;
  creatorProfileId: string; videoUrl: string; videoId?: string | null; views: number;
  submittedAt: string; hoursUntilAutoApprove: number; tapId?: string | null; tapName?: string | null;
  autoApproveAt?: string | null; metricsUpdatedAt?: string | null;
}
export const useTapSubmissions = () => useQuery({
  queryKey: ['tap-submissions'],
  queryFn: async () => (await api.get<ApiResponse<TapSubmission[]>>('/brand/tap/submissions')).data.data,
  refetchInterval: 60000,
});

export interface SupportMessage { id: string; body: string; fromAdmin: boolean; senderName: string; isRead: boolean; createdAt: string }
export const useSupportThread = () => useQuery({
  queryKey: ['support-thread'],
  queryFn: async () => (await api.get<ApiResponse<SupportMessage[]>>('/messages')).data.data,
  refetchInterval: 30000,
});

export interface MyTikTokVideo { videoId: string; title: string; coverImageUrl?: string | null; shareUrl: string; publishedAt: string; views: number; likes: number; alreadyTracked: boolean; trackedFor?: string | null }
export const useMyTikTokVideos = (enabled: boolean) => useQuery({
  queryKey: ['my-tiktok-videos'],
  queryFn: async () => (await api.get<ApiResponse<MyTikTokVideo[]>>('/assignments/my-tiktok-videos')).data.data,
  enabled,
  staleTime: 60000,
});
