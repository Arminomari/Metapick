import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  ApiResponse,
  AssignmentDetail,
  AssignmentListItem,
  AuthResponse,
  CampaignAnalytics,
  CampaignBrowseItem,
  CampaignDetail,
  CampaignListItem,
  ApplicationItem,
  CreatorProfile,
  CursorPagedResult,
  Notification,
  PagedResult,
  PayoutCalculation,
  PayoutRequest,
  Submission,
  UserProfile,
  ReviewDto,
  UserReviewSummary,
  ChatMessageDto,
  SubmitReviewRequest,
  SendMessageRequest,
} from '@/types';

// ── Auth hooks ─────────────────────────────────────────
export function useLogin() {
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await api.post<ApiResponse<AuthResponse>>('/auth/login', data);
      return res.data.data;
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);
      return res.data.data;
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UserProfile>>('/auth/profile');
      return res.data.data;
    },
  });
}

export function useCreatorProfile() {
  return useQuery({
    queryKey: ['creator-profile'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CreatorProfile>>('/creator/profile');
      return res.data.data;
    },
  });
}

export function useUpdateCreatorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CreatorProfile> & { tikTokUsername?: string; dateOfBirth?: string }) => {
      const res = await api.put<ApiResponse<CreatorProfile>>('/creator/profile', data);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creator-profile'] }),
  });
}

// ── TikTok hooks ───────────────────────────────────────
export function useTikTokAuthUrl() {
  return useQuery({
    queryKey: ['tiktok-auth-url'],
    queryFn: async () => {
      const res = await api.get<{ url: string }>('/creator/tiktok/auth-url');
      return res.data.url;
    },
    enabled: false, // only fetch on demand
  });
}

export function useTikTokCallback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post<ApiResponse<{ username: string; displayName: string; followerCount: number }>>('/creator/tiktok/callback', { code });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tiktok-status'] });
      qc.invalidateQueries({ queryKey: ['creator-profile'] });
    },
  });
}

export function useTikTokStatus() {
  return useQuery({
    queryKey: ['tiktok-status'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ connected: boolean; username?: string; displayName?: string; followerCount?: number; connectedAt?: string; lastSyncAt?: string; isOAuth?: boolean }>>('/creator/tiktok/status');
      return res.data.data;
    },
  });
}

export function useTikTokDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete('/creator/tiktok/disconnect');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tiktok-status'] });
      qc.invalidateQueries({ queryKey: ['creator-profile'] });
    },
  });
}

// ── Campaign hooks ─────────────────────────────────────
export function useBrandCampaigns(status?: string, page = 1) {
  return useQuery({
    queryKey: ['brand-campaigns', status, page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<CampaignListItem>>>('/campaigns/mine', {
        params: { status, page },
      });
      return res.data.data;
    },
  });
}

export function useBrowseCampaigns(category?: string, country?: string, page = 1) {
  return useQuery({
    queryKey: ['browse-campaigns', category, country, page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<CampaignBrowseItem>>>('/campaigns/browse', {
        params: { category, country, page },
      });
      return res.data.data;
    },
    refetchInterval: 10_000,
  });
}

/** Infinite-scroll campaign browsing using cursor-based pagination (no COUNT query). */
export function useBrowseCampaignsCursor(category?: string, country?: string, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: ['browse-campaigns-cursor', category, country],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const res = await api.get<ApiResponse<CursorPagedResult<CampaignBrowseItem>>>('/campaigns/browse/cursor', {
        params: { category, country, cursor: pageParam ?? undefined, pageSize },
      });
      return res.data.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : null,
  });
}

export function useCampaignDetail(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CampaignDetail>>(`/campaigns/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCampaignAnalytics(id: string) {
  return useQuery({
    queryKey: ['campaign-analytics', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CampaignAnalytics>>(`/campaigns/${id}/analytics`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<ApiResponse<CampaignDetail>>('/campaigns', data);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-campaigns'] }),
  });
}

export function usePublishCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<ApiResponse<CampaignDetail>>(`/campaigns/${id}/publish`);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

// ── Application hooks ──────────────────────────────────
export function useApplyToCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { campaignId: string; message: string }) => {
      const res = await api.post<ApiResponse<ApplicationItem>>('/applications', data);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-applications'] }),
  });
}

export function useMyApplications() {
  return useQuery({
    queryKey: ['my-applications'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<ApplicationItem>>>('/applications/mine', { params: { pageSize: 100 } });
      return res.data.data;
    },
  });
}

export function useCampaignApplications(campaignId: string, status?: string, page = 1) {
  return useQuery({
    queryKey: ['campaign-applications', campaignId, status, page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<ApplicationItem>>>(
        `/applications/campaign/${campaignId}`,
        { params: { status, page } },
      );
      return res.data.data;
    },
    enabled: !!campaignId,
  });
}

export function useApproveApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await api.post<ApiResponse<ApplicationItem>>(`/applications/${id}/approve`, null, { params: { note } });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-applications'] }),
  });
}

export function useRejectApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.post<ApiResponse<ApplicationItem>>(`/applications/${id}/reject`, { reason });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-applications'] }),
  });
}

// ── Assignment hooks ───────────────────────────────────
export function useApproveSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const res = await api.post<ApiResponse<Submission>>(`/assignments/submissions/${submissionId}/approve`);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-analytics'] });
      qc.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

export function useRejectSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.post<ApiResponse<Submission>>(`/assignments/submissions/${id}/reject`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-analytics'] });
      qc.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

export function useMarkManualPayoutSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await api.post<ApiResponse<PayoutRequest>>(`/payouts/assignments/${assignmentId}/manual`);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-analytics'] });
      qc.invalidateQueries({ queryKey: ['campaign'] });
      qc.invalidateQueries({ queryKey: ['creator-payouts'] });
    },
  });
}

export function useCreatorAssignments(status?: string, page = 1) {
  return useQuery({
    queryKey: ['creator-assignments', status, page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<AssignmentListItem>>>('/assignments/mine', {
        params: { status, page },
      });
      return res.data.data;
    },
  });
}

export function useAssignmentDetail(id: string) {
  return useQuery({
    queryKey: ['assignment', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AssignmentDetail>>(`/assignments/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useSubmitVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, ...data }: { assignmentId: string; videoUrl: string; caption?: string }) => {
      const res = await api.post(`/assignments/${assignmentId}/submit`, data);
      return res.data.data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['assignment', vars.assignmentId] }),
  });
}

// ── Payout hooks ───────────────────────────────────────
export function useCreatorPayouts(status?: string, page = 1) {
  return useQuery({
    queryKey: ['creator-payouts', status, page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<PayoutRequest>>>('/payouts/mine', {
        params: { status, page },
      });
      return res.data.data;
    },
  });
}

export function usePayoutCalculation(assignmentId: string) {
  return useQuery({
    queryKey: ['payout-calculation', assignmentId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PayoutCalculation>>(`/payouts/calculation/${assignmentId}`);
      return res.data.data;
    },
    enabled: !!assignmentId,
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { calculationId: string; idempotencyKey?: string }) => {
      const res = await api.post<ApiResponse<PayoutRequest>>('/payouts/request', data);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['creator-payouts'] }),
  });
}

// ── Notification hooks ─────────────────────────────────
export function useNotifications(unreadOnly?: boolean, page = 1) {
  return useQuery({
    queryKey: ['notifications', unreadOnly, page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<Notification>>>('/notifications', {
        params: { unreadOnly, page },
      });
      return res.data.data;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ── Admin hooks ────────────────────────────────────────
export function useTriggerSync() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ message: string }>('/admin/trigger-sync');
      return res.data;
    },
  });
}

// ── Brand hooks ────────────────────────────────────────
export function useBrandProfile() {
  return useQuery({
    queryKey: ['brand-profile'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ id: string; companyName: string; website?: string; industry: string; description?: string; contactPhone?: string; status: string }>>('/brand/profile');
      return res.data.data;
    },
  });
}

export function useUpdateBrandProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { companyName: string; website?: string; industry: string; description?: string; contactPhone?: string }) => {
      const res = await api.put('/brand/profile', data);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-profile'] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await api.post('/auth/change-password', data);
      return res.data;
    },
  });
}

// ── Review hooks ────────────────────────────────────
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, ...data }: SubmitReviewRequest & { assignmentId: string }) => {
      const res = await api.post<ApiResponse<ReviewDto>>(`/reviews/assignments/${assignmentId}`, data);
      return res.data.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['reviews-mine', vars.assignmentId] });
      qc.invalidateQueries({ queryKey: ['user-reviews'] });
    },
  });
}

export function useUserReviews(userId: string) {
  return useQuery({
    queryKey: ['user-reviews', userId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UserReviewSummary>>(`/reviews/users/${userId}`);
      return res.data.data;
    },
    enabled: !!userId,
  });
}

export function useMyReviewForAssignment(assignmentId: string) {
  return useQuery({
    queryKey: ['reviews-mine', assignmentId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ReviewDto | null>>(`/reviews/assignments/${assignmentId}/mine`);
      return res.data.data;
    },
    enabled: !!assignmentId,
  });
}

// ── Chat hooks ───────────────────────────────────────
export function useChatMessages(assignmentId: string) {
  return useQuery({
    queryKey: ['chat', assignmentId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ChatMessageDto[]>>(`/chat/assignments/${assignmentId}/messages`);
      return res.data.data;
    },
    enabled: !!assignmentId,
    refetchInterval: 8000, // poll every 8 seconds
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, ...data }: SendMessageRequest & { assignmentId: string }) => {
      const res = await api.post<ApiResponse<ChatMessageDto>>(`/chat/assignments/${assignmentId}/messages`, data);
      return res.data.data;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['chat', vars.assignmentId] }),
  });
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      await api.post(`/chat/assignments/${assignmentId}/read`);
    },
    onSuccess: (_d, assignmentId) => qc.invalidateQueries({ queryKey: ['chat', assignmentId] }),
  });
}

export function useUnreadChatCount() {
  return useQuery({
    queryKey: ['chat-unread'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<number>>('/chat/unread');
      return res.data.data;
    },
    refetchInterval: 15000,
  });
}
