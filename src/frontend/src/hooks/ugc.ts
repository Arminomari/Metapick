import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import type { ApiResponse } from '@/types';

// ═══════════════════════════════════════════════════════════════════
// UGC-marknadsplatsen — "Beställ video". Types mirror the API DTOs;
// money is öre (integers) on the wire and formatted only for display.
// ═══════════════════════════════════════════════════════════════════

export interface UgcBrief {
  goal: string; format: string; lengthSeconds: number; videoCount: number; hooks: string[];
  callToAction: string; referenceUrls: string[]; dos: string[]; donts: string[]; extraNotes?: string | null;
}

export interface UgcCampaign {
  id: string; brandProfileId: string; brandName: string; brandLogoUrl?: string | null;
  title: string; brief: UgcBrief; briefGeneratedByAi: boolean;
  region?: string | null; categories: string[]; minFollowers?: number | null; maxFollowers?: number | null;
  compensation: 'Paid' | 'ProductExchange' | 'PaidPlusProduct'; budgetMinOre: number; budgetMaxOre: number;
  productDescription?: string | null; productValueOre?: number | null;
  rightsPackage: 'Organic' | 'OrganicPlusAds6M' | 'OrganicPlusAds12M' | 'FullTransfer';
  deadlineDays: number; slots: number; hiredCount: number; applicationCount: number; pendingApplicationCount: number;
  status: 'Draft' | 'Published' | 'Closed'; publishedAt?: string | null; closedAt?: string | null; createdAt: string;
  myApplicationStatus?: string | null; myApplicationId?: string | null; myBidOre?: number | null; myCollabId?: string | null;
}

export interface UpsertUgcCampaign {
  title: string; brief: UgcBrief; region?: string | null; categories?: string[]; minFollowers?: number | null; maxFollowers?: number | null;
  compensation: string; budgetMinOre: number; budgetMaxOre: number; productDescription?: string | null; productValueOre?: number | null;
  rightsPackage: string; deadlineDays: number; slots: number; briefGeneratedByAi?: boolean;
}

export interface UgcApplication {
  id: string; campaignId: string; campaignTitle: string; creatorProfileId: string; creatorName: string; creatorAvatarUrl?: string | null;
  creatorCategory?: string | null; city?: string | null; region?: string | null; followers: number; likeFollowerRatio: number;
  deliveredCount: number; onTimeCount: number; averageRating: number; ratingCount: number; creatorStatus: string;
  bidOre: number; pitch: string; status: 'Applied' | 'Preselected' | 'Hired' | 'Rejected' | 'Withdrawn';
  createdAt: string; decidedAt?: string | null; decisionNote?: string | null; collabId?: string | null;
}

export interface UgcDeliverable {
  id: string; version: number; fileUrl: string; contentType: string; fileSizeBytes: number; durationSeconds?: number | null;
  creatorComment?: string | null; brandFeedback?: string | null; feedbackAt?: string | null; createdAt: string;
}
export interface UgcPayment {
  status: string; brandPaidOre: number; creatorAmountOre: number; platformFeeOre: number; transferredOre: number; refundedOre: number;
  heldAt?: string | null; transferredAt?: string | null; refundedAt?: string | null; lastError?: string | null;
}
export interface UgcDispute {
  id: string; openedBy: string; reason: string; status: string; decision?: string | null; creatorSharePercent?: number | null;
  adminReasoning?: string | null; createdAt: string; resolvedAt?: string | null;
}
export interface UgcMessage {
  id: string; senderUserId: string; senderRole: string; senderName: string; body: string; attachmentUrl?: string | null; isRead: boolean; createdAt: string;
}
export interface UgcEvent { from?: string | null; to: string; actor: string; note?: string | null; at: string }

export type UgcCollabStatus = 'Invited' | 'Accepted' | 'InProgress' | 'Submitted' | 'RevisionRequested' | 'Approved' | 'Paid' | 'Cancelled' | 'Disputed';

export interface UgcCollabListItem {
  id: string; campaignId?: string | null; title: string; status: UgcCollabStatus; compensation: string;
  agreedAmountOre: number; platformFeeOre: number; brandTotalOre: number;
  brandProfileId: string; brandName: string; brandLogoUrl?: string | null;
  creatorProfileId: string; creatorName: string; creatorAvatarUrl?: string | null;
  deadlineAt?: string | null; autoApproveAt?: string | null; revisionCount: number; maxRevisions: number;
  deliverableCount: number; unreadMessages: number; needsMyAction: boolean; funded: boolean; createdAt: string; updatedAt: string;
}

export interface UgcCollab extends Omit<UgcCollabListItem, 'deliverableCount' | 'needsMyAction' | 'funded'> {
  applicationId?: string | null; briefSnapshot: string; feePercentApplied: number;
  productDescription?: string | null; productValueOre?: number | null; rightsPackage: string;
  deadlineDays: number; submittedAt?: string | null; approvedAt?: string | null; paidAt?: string | null; cancelledAt?: string | null;
  cancelReason?: string | null; noShow: boolean;
  contractText: string; contractHash: string; contractTemplateVersion: string; brandAcceptedAt?: string | null; creatorAcceptedAt?: string | null;
  brandRating?: number | null; licenseAvailable: boolean; brandUserId: string; creatorUserId: string;
  payment?: UgcPayment | null; dispute?: UgcDispute | null; deliverables: UgcDeliverable[]; events: UgcEvent[];
  availableActions: string[];
}

export interface UgcCreatorProfile {
  creatorProfileId: string; displayName: string; avatarUrl?: string | null;
  status: 'Pending' | 'Verified' | 'Approved' | 'Suspended'; statusNote?: string | null; strikes: number;
  categories: string[]; city?: string | null; region?: string | null; languages: string[]; sampleVideoUrl?: string | null;
  followerSnapshot: number; likeFollowerRatio: number; socialSnapshotAt?: string | null;
  deliveredCount: number; onTimeCount: number; lateCount: number; averageRating: number; ratingCount: number;
  hasStripeAccount: boolean; payoutOnboardingComplete: boolean; hasFTax: boolean; vatRegistered: boolean; vatNumber?: string | null;
  allowPortfolioUse: boolean; canTakePaid: boolean; canTakeProduct: boolean; blocker?: string | null;
}
export interface UgcPayoutOnboarding { url?: string | null; complete: boolean; accountId?: string | null; configured: boolean; message?: string | null }
export interface UgcCheckout { url?: string | null; funded: boolean; productExchange: boolean; message?: string | null }

export interface UgcAdminOverview {
  pendingVerification: number; verifiedAwaitingApproval: number; openDisputes: number; activeCollabs: number; publishedCampaigns: number;
  heldOre: number; paidOutOre: number; feesEarnedOre: number; feePercent: number; autoApproveDays: number; revisionDeadlineDays: number;
  maxRevisions: number; strikesToSuspend: number; autoVerifyMinFollowers: number; autoVerifyMinLikeFollowerRatio: number; requireFTaxForPaid: boolean;
  stripeConfigured: boolean; storageConfigured: boolean; aiConfigured: boolean; contractTemplateVersion: string;
}
export interface UgcAdminCreatorRow {
  creatorProfileId: string; userId: string; displayName: string; avatarUrl?: string | null; email: string; tikTokUsername?: string | null;
  status: string; statusNote?: string | null; strikes: number; followerSnapshot: number; likeFollowerRatio: number; categories: string[];
  city?: string | null; sampleVideoUrl?: string | null; payoutOnboardingComplete: boolean; deliveredCount: number; averageRating: number; createdAt: string;
}
export interface UgcAdminDisputeRow {
  disputeId: string; collabId: string; title: string; brandName: string; creatorName: string; openedBy: string; reason: string; status: string;
  decision?: string | null; creatorSharePercent?: number | null; agreedAmountOre: number; brandPaidOre: number; openedAt: string; resolvedAt?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────

/** 172 500 öre → "1 725 kr" (whole kronor unless there are öre). */
export function formatOre(ore: number | null | undefined): string {
  const v = Math.round(ore ?? 0);
  const kr = Math.trunc(v / 100);
  const rest = Math.abs(v % 100);
  const whole = new Intl.NumberFormat('sv-SE').format(kr);
  return rest === 0 ? `${whole} kr` : `${whole},${String(rest).padStart(2, '0')} kr`;
}
export const kronorToOre = (kr: string | number) => Math.round((typeof kr === 'string' ? Number(kr.replace(',', '.').replace(/\s/g, '')) || 0 : kr) * 100);
export const oreToKronor = (ore: number | null | undefined) => ore == null ? '' : String(Math.round(ore) / 100);

export const COMPENSATION_LABEL: Record<string, string> = { Paid: 'Betalt', ProductExchange: 'Produktbyte', PaidPlusProduct: 'Betalt + produkt' };
export const RIGHTS_LABEL: Record<string, string> = {
  Organic: 'Organiskt', OrganicPlusAds6M: 'Organiskt + annonser 6 mån', OrganicPlusAds12M: 'Organiskt + annonser 12 mån', FullTransfer: 'Fullständig överlåtelse',
};
export const RIGHTS_HINT: Record<string, string> = {
  Organic: 'Egna kanaler, obegränsad tid. Ingen betald annonsering.',
  OrganicPlusAds6M: 'Egna kanaler + betald annonsering i 6 månader.',
  OrganicPlusAds12M: 'Egna kanaler + betald annonsering i 12 månader.',
  FullTransfer: 'Alla ekonomiska rättigheter överlåts. Kräver vanligen högre pris.',
};
export const COLLAB_STATUS_SV: Record<string, string> = {
  Invited: 'Inbjuden', Accepted: 'Accepterad', InProgress: 'Pågår', Submitted: 'Levererad', RevisionRequested: 'Revision',
  Approved: 'Godkänd', Paid: 'Betald', Cancelled: 'Avbruten', Disputed: 'Tvist',
};
export const COLLAB_TONE: Record<string, string> = {
  Invited: 'pend', Accepted: 'info', InProgress: 'info', Submitted: 'pend', RevisionRequested: 'pend',
  Approved: 'pos', Paid: 'pos', Cancelled: 'neg', Disputed: 'neg',
};
export const collabStatusLabel = (s: string) => t(COLLAB_STATUS_SV[s] ?? s);
export const CREATOR_STATUS_SV: Record<string, string> = { Pending: 'Väntar', Verified: 'Verifierad', Approved: 'Godkänd', Suspended: 'Avstängd' };
export const UGC_CATEGORIES = ['Mat & Dryck', 'Skönhet', 'Mode', 'Fitness', 'Hem & Inredning', 'Teknik', 'Barn & Familj', 'Resor', 'Nöje', 'Tjänster', 'Övrigt'];
export const UGC_REGIONS = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro', 'Västerås', 'Helsingborg', 'Norrköping', 'Jönköping', 'Umeå', 'Lund', 'Hela Sverige'];

export const apiError = (e: any, fallback: string) => e?.response?.data?.error?.message ?? e?.response?.data?.title ?? fallback;

const get = async <T,>(url: string, params?: Record<string, unknown>) => (await api.get<ApiResponse<T>>(url, { params })).data.data;
const post = async <T,>(url: string, body?: unknown) => (await api.post<ApiResponse<T>>(url, body ?? {})).data.data;

// ── Creator hooks ──────────────────────────────────────────────────

export const useUgcCreatorProfile = () => useQuery({ queryKey: ['ugc', 'creator-profile'], queryFn: () => get<UgcCreatorProfile>('/ugc/creator/profile') });
export function useUpsertUgcCreatorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<UgcCreatorProfile>) => (await api.put<ApiResponse<UgcCreatorProfile>>('/ugc/creator/profile', body)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc', 'creator-profile'] }),
  });
}
export function useRefreshUgcVerification() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => post<UgcCreatorProfile>('/ugc/creator/profile/refresh'), onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc', 'creator-profile'] }) });
}
export const useUgcPayoutStatus = (enabled = true) => useQuery({ queryKey: ['ugc', 'payout-status'], queryFn: () => get<UgcPayoutOnboarding>('/ugc/creator/payout/status'), enabled });
export const useStartUgcPayoutOnboarding = () => useMutation({ mutationFn: () => post<UgcPayoutOnboarding>('/ugc/creator/payout/onboarding') });

export const useUgcCreatorCampaigns = (matching: boolean) => useQuery({ queryKey: ['ugc', 'creator-campaigns', matching], queryFn: () => get<UgcCampaign[]>('/ugc/creator/campaigns', { matching }) });
export const useUgcCreatorCampaign = (id: string) => useQuery({ queryKey: ['ugc', 'creator-campaign', id], queryFn: () => get<UgcCampaign>(`/ugc/creator/campaigns/${id}`), enabled: !!id });
export function useApplyToUgcCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, bidOre, pitch }: { campaignId: string; bidOre: number; pitch: string }) => post<UgcApplication>(`/ugc/creator/campaigns/${campaignId}/apply`, { bidOre, pitch }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ugc', 'creator-campaigns'] }); qc.invalidateQueries({ queryKey: ['ugc', 'creator-applications'] }); },
  });
}
export const useUgcMyApplications = () => useQuery({ queryKey: ['ugc', 'creator-applications'], queryFn: () => get<UgcApplication[]>('/ugc/creator/applications') });
export function useWithdrawUgcApplication() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => post<boolean>(`/ugc/creator/applications/${id}/withdraw`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['ugc', 'creator-applications'] }); qc.invalidateQueries({ queryKey: ['ugc', 'creator-campaigns'] }); } });
}

// ── Brand hooks ────────────────────────────────────────────────────

export const useUgcBrandCampaigns = (status?: string) => useQuery({ queryKey: ['ugc', 'brand-campaigns', status], queryFn: () => get<UgcCampaign[]>('/ugc/brand/campaigns', { status }) });
export const useUgcBrandCampaign = (id: string) => useQuery({ queryKey: ['ugc', 'brand-campaign', id], queryFn: () => get<UgcCampaign>(`/ugc/brand/campaigns/${id}`), enabled: !!id });
export function useSaveUgcCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: UpsertUgcCampaign }) =>
      id ? (await api.put<ApiResponse<UgcCampaign>>(`/ugc/brand/campaigns/${id}`, body)).data.data : post<UgcCampaign>('/ugc/brand/campaigns', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc', 'brand-campaign'] }),
  });
}
export function useUgcCampaignAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'publish' | 'close' | 'delete' }) =>
      action === 'delete' ? (await api.delete(`/ugc/brand/campaigns/${id}`)).data : post<UgcCampaign>(`/ugc/brand/campaigns/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc'] }),
  });
}
export const useGenerateUgcBrief = () => useMutation({ mutationFn: (body: { goal?: string; productOrService?: string; audience?: string; tone?: string; extra?: string }) => post<UgcBrief>('/ugc/brand/campaigns/generate-brief', body) });
export const useUgcCampaignApplications = (campaignId: string) => useQuery({ queryKey: ['ugc', 'campaign-applications', campaignId], queryFn: () => get<UgcApplication[]>(`/ugc/brand/campaigns/${campaignId}/applications`), enabled: !!campaignId });
export function useUgcApplicationDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'preselect' | 'reject' | 'hire'; note?: string }) => post<unknown>(`/ugc/brand/applications/${id}/${action}`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc'] }),
  });
}
export const useUgcDirectInvite = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: Record<string, unknown>) => post<UgcCollab>('/ugc/brand/collabs/invite', body), onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc'] }) });
};

// ── Collab hooks (role-aware path) ─────────────────────────────────

export type UgcRole = 'brand' | 'creator' | 'admin';
const base = (role: UgcRole) => `/ugc/${role}`;

export const useUgcCollabs = (role: UgcRole, status?: string) => useQuery({ queryKey: ['ugc', 'collabs', role, status], queryFn: () => get<UgcCollabListItem[]>(`${base(role)}/collabs`, { status }), refetchInterval: 30000 });
export const useUgcCollab = (role: UgcRole, id: string) => useQuery({ queryKey: ['ugc', 'collab', id], queryFn: () => get<UgcCollab>(`${base(role)}/collabs/${id}`), enabled: !!id, refetchInterval: 30000 });
export const useUgcMessages = (role: UgcRole, id: string) => useQuery({ queryKey: ['ugc', 'messages', id], queryFn: () => get<UgcMessage[]>(`${base(role)}/collabs/${id}/messages`), enabled: !!id, refetchInterval: 15000 });
export const useUgcActionCount = (role: 'brand' | 'creator' | null) => useQuery({ queryKey: ['ugc', 'action-count', role], queryFn: () => get<number>(`${base(role!)}/action-count`), enabled: !!role, refetchInterval: 30000 });

/** One mutation for every button on the collab page; the server decides what is allowed. */
export function useUgcCollabAction(role: UgcRole, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, body }: { action: string; body?: unknown }) => {
      const url = `${base(role)}/collabs/${id}/${action}`;
      return (await api.post<ApiResponse<unknown>>(url, body ?? {})).data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ugc'] }); },
  });
}
export function useSubmitUgcDeliverable(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, comment, onProgress }: { file: File; comment?: string; onProgress?: (pct: number) => void }) => {
      const form = new FormData();
      form.append('file', file);
      if (comment) form.append('comment', comment);
      const res = await api.post<ApiResponse<UgcCollab>>(`/ugc/creator/collabs/${id}/submit`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
        timeout: 15 * 60 * 1000,
      });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc'] }),
  });
}
export function useSendUgcMessage(role: UgcRole, id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: string) => post<UgcMessage>(`${base(role)}/collabs/${id}/messages`, { body }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc', 'messages', id] }) });
}

// ── Admin hooks ────────────────────────────────────────────────────

export const useUgcAdminOverview = () => useQuery({ queryKey: ['ugc', 'admin-overview'], queryFn: () => get<UgcAdminOverview>('/ugc/admin/overview') });
export const useUgcAdminCreators = (status?: string) => useQuery({ queryKey: ['ugc', 'admin-creators', status], queryFn: () => get<UgcAdminCreatorRow[]>('/ugc/admin/creators', { status }) });
export const useUgcAdminDisputes = (open: boolean) => useQuery({ queryKey: ['ugc', 'admin-disputes', open], queryFn: () => get<UgcAdminDisputeRow[]>('/ugc/admin/disputes', { open }) });
export function useUgcAdminSetCreatorStatus() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => post<UgcAdminCreatorRow>(`/ugc/admin/creators/${id}/status`, { status, note }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc'] }) });
}
export function useUgcAdminResolveDispute() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, decision, creatorSharePercent, reasoning }: { id: string; decision: string; creatorSharePercent?: number; reasoning: string }) => post<UgcAdminDisputeRow>(`/ugc/admin/disputes/${id}/resolve`, { decision, creatorSharePercent, reasoning }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc'] }) });
}
export function useUgcAdminMarkFunded() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => post<UgcCollab>(`/ugc/admin/collabs/${id}/mark-funded`, { reason }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc'] }) });
}
