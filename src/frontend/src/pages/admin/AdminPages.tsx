import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AdminOverviewSection, AdminPayoutsSection, AdminFraudSection, AdminAuditSection, AdminCreateAdminCard, AdminBroadcastCard } from './AdminExtraSections';
import { AdminSupportInboxCard, AdminUserThreadModal, useAdminUnreadThreads } from './AdminSupportInbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useTriggerSync } from '@/hooks/api';
import type { ApiResponse, PagedResult } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { t } from '@/lib/i18n';

interface PendingUser {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  companyName?: string;
  organizationNumber?: string;
  contactPhone?: string;
  displayName?: string;
  bio?: string;
  category?: string;
  tikTokUsername?: string;
  dateOfBirth?: string;
  rejectionReason?: string;
  authProvider?: string;
  avatarUrl?: string;
  followerCount?: number;
  instagramUsername?: string;
  website?: string;
  industry?: string;
}

interface AdminCampaign {
  id: string;
  name: string;
  brandName: string;
  category: string;
  country: string;
  status: string;
  budget: number;
  maxCreators: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

function getApiErrorMessage(error: any, fallback: string) {
  const apiError = error?.response?.data?.error;
  const detail = Array.isArray(apiError?.details) ? apiError.details[1] ?? apiError.details[0] : undefined;
  return detail
    ?? apiError?.message
    ?? error?.response?.data?.title
    ?? error?.message
    ?? fallback;
}

type AdminSection = 'overview' | 'users' | 'campaigns' | 'payouts' | 'fraud' | 'audit';

const s = {
  page: { minHeight: '100vh', background: 'radial-gradient(1200px 600px at 12% -8%, rgba(255,216,199,.55), transparent 60%), radial-gradient(900px 500px at 105% 0%, rgba(237,225,255,.45), transparent 55%), #FFF4EC', color: '#0B0F17', padding: 'clamp(1rem, 4vw, 2rem)' } as React.CSSProperties,
  container: { width: '100%', maxWidth: 1160, margin: '0 auto', minWidth: 0 } as React.CSSProperties,
  header: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.6rem' } as React.CSSProperties,
  title: { fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 700, letterSpacing: '-0.02em' } as React.CSSProperties,
  tabs: { display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '1.6rem' } as React.CSSProperties,
  tab: (active: boolean) => ({ padding: '.5rem 1.1rem', borderRadius: 980, border: active ? '1px solid #0B0F17' : '1px solid rgba(241,168,143,.25)', background: active ? 'linear-gradient(135deg,#1A2230,#0B0F17)' : 'rgba(255,255,255,.7)', color: active ? '#fff' : '#2C333F', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }) as React.CSSProperties,
  card: { background: 'rgba(255,255,255,.82)', border: '1px solid rgba(255,255,255,.7)', borderRadius: 24, padding: 'clamp(1rem, 3.5vw, 1.5rem)', marginBottom: '1rem', minWidth: 0, boxShadow: '0 10px 34px rgba(180,120,90,.08), 0 2px 8px rgba(11,15,23,.04)' } as React.CSSProperties,
  badge: (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      PendingVerification: { bg: 'rgba(255,216,199,.55)', color: '#b07d1c' },
      Active: { bg: 'rgba(47,157,91,.12)', color: '#2f9d5b' },
      Deactivated: { bg: 'rgba(207,75,75,.12)', color: '#cf4b4b' },
    };
    const c = colors[status] || colors.PendingVerification;
    return { display: 'inline-block', padding: '.25rem .75rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 600, background: c.bg, color: c.color } as React.CSSProperties;
  },
  roleBadge: (role: string) => {
    const c = role === 'Creator' ? { bg: 'rgba(255,216,199,.6)', color: '#9c4f31' } : { bg: '#EDE1FF', color: '#6a4ea8' };
    return { display: 'inline-block', padding: '.25rem .75rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 600, background: c.bg, color: c.color } as React.CSSProperties;
  },
  btnApprove: { padding: '.55rem 1.3rem', borderRadius: 980, background: '#2f9d5b', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' } as React.CSSProperties,
  btnReject: { padding: '.55rem 1.3rem', borderRadius: 980, background: '#cf4b4b', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' } as React.CSSProperties,
  detailRow: { display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.5rem', fontSize: '.875rem' } as React.CSSProperties,
  detailLabel: { color: '#6E7480', minWidth: 160, flex: '0 0 auto' } as React.CSSProperties,
  detailValue: { color: '#0B0F17', flex: '1 1 180px', minWidth: 0, overflowWrap: 'anywhere' } as React.CSSProperties,
  empty: { textAlign: 'center', padding: '4rem 0', color: '#6E7480' } as React.CSSProperties,
};


function usePendingUsers(page: number) {
  return useQuery({
    queryKey: ['admin-users', page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<PendingUser>>>('/admin/users', { params: { page, pageSize: 20 } });
      return res.data.data;
    },
  });
}

function usePendingCampaigns(page: number) {
  return useQuery({
    queryKey: ['admin-campaigns-pending', page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PagedResult<AdminCampaign>>>('/admin/campaigns/pending', { params: { page, pageSize: 20 } });
      return res.data.data;
    },
  });
}

function useApproveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/admin/campaigns/${id}/approve`);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-campaigns-pending'] }),
  });
}

function useRejectCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.post(`/admin/campaigns/${id}/reject`, { reason });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-campaigns-pending'] }),
  });
}

function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/users/${id}`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/admin/users/${id}/approve`);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.post(`/admin/users/${id}/reject`, { reason });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

// ── Admin Creator Profile Page ────────────────────────────────
interface AdminCreatorFull {
  userId: string; email: string; emailVerified: boolean; accountStatus: string; authProvider?: string | null;
  registeredAt: string; lastLoginAt?: string | null;
  creatorProfileId: string; displayName: string; bio?: string | null; category: string; country: string; language: string;
  avatarUrl?: string | null; website?: string | null; dateOfBirth?: string | null; profileTags: string[];
  followerCount: number; averageViews?: number | null; instagramUsername?: string | null; instagramFollowerCount: number;
  profileStatus: string;
  tikTokUsername?: string | null; tikTokConnected: boolean; tikTokOAuth: boolean; tikTokFollowerCount: number; tikTokLastSync?: string | null;
  selfieUrl?: string | null;
  activeAssignments: number; completedAssignments: number; totalVerifiedViews: number; totalEarned: number; totalPaidOut: number;
  payoutMethodConfigured: boolean; payoutMethod?: string | null;
  averageRating: number; reviewCount: number; portfolioCount: number;
}

const apCard: React.CSSProperties = { background: '#fff', borderRadius: 18, border: '1px solid rgba(241,168,143,.25)', padding: '1.2rem clamp(.9rem, 3.5vw, 1.4rem)', marginBottom: 14, minWidth: 0, boxShadow: '0 8px 24px rgba(180,120,90,.06)' };
const apMuted: React.CSSProperties = { fontSize: '.8rem', color: '#8a8f9c' };
const apPill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 980, fontSize: '.75rem', fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' });
const apStat = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
  <div key={label} style={{ padding: '12px 14px', borderRadius: 13, background: 'rgba(255,244,236,.75)', border: '1px solid rgba(241,168,143,.2)' }}>
    <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#8a8f9c' }}>{label}</div>
    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0B0F17', marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: '.72rem', color: '#8a8f9c', marginTop: 1 }}>{sub}</div>}
  </div>
);
const apRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div key={label} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', padding: '7px 0', borderBottom: '1px solid rgba(241,168,143,.14)', fontSize: '.86rem' }}>
    <span style={{ color: '#8a8f9c', minWidth: 160, flex: '0 0 auto' }}>{label}</span>
    <span style={{ color: '#0B0F17', fontWeight: 600, wordBreak: 'break-word', flex: '1 1 160px', minWidth: 0 }}>{value}</span>
  </div>
);

function AdminCreatorProfilePage({ creatorId, onBack }: { creatorId: string; onBack: () => void }) {
  const { data: p, isLoading, isError, error } = useQuery({
    queryKey: ['admin-creator-profile', creatorId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AdminCreatorFull>>(`/admin/creators/${creatorId}`);
      return res.data.data;
    },
  });

  const qc = useQueryClient();
  const approveCreator = useMutation({
    mutationFn: async () => (await api.post(`/admin/users/${creatorId}/approve`)).data.data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-creator-profile'] }); onBack(); },
  });
  const rejectCreator = useMutation({
    mutationFn: async (reason: string) => (await api.post(`/admin/users/${creatorId}/reject`, { reason })).data.data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-creator-profile'] }); onBack(); },
  });
  const [rejectReason, setRejectReason] = useState('');
  const deleteAccount = useMutation({
    mutationFn: async () => (await api.delete(`/admin/users/${creatorId}`)).data.data,
    onSuccess: () => onBack(),
  });
  const [armedDelete, setArmedDelete] = useState(false);

  if (isLoading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#8a8f9c' }}>{t('Laddar…')}</div>;
  if (isError || !p) return (
    <div style={{ padding: 'clamp(1rem, 4vw, 2rem)', width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#9c4f31', fontWeight: 700, cursor: 'pointer', marginBottom: 14, padding: 0 }}>← {t('Tillbaka till admin-panel')}</button>
      <div style={{ ...apCard, overflowWrap: 'anywhere' }}>{t('Kunde inte hämta profilen.')} {(error as any)?.response?.data?.error?.message ?? ''}</div>
    </div>
  );

  const engagementless = p.totalVerifiedViews === 0;

  return (
    <div style={{ padding: 'clamp(1.25rem, 4vw, 2rem) clamp(.85rem, 4vw, 1.5rem)', width: '100%', maxWidth: 980, margin: '0 auto', minWidth: 0 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#9c4f31', fontWeight: 700, cursor: 'pointer', marginBottom: 14, padding: 0, fontSize: '.9rem' }}>← {t('Tillbaka till admin-panel')}</button>

      {/* ── Header ── */}
      <div style={apCard}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {p.avatarUrl
            ? <img src={p.avatarUrl} alt="" style={{ width: 76, height: 76, borderRadius: 18, objectFit: 'cover', flex: '0 0 76px' }} />
            : <div style={{ width: 76, height: 76, borderRadius: 18, flex: '0 0 76px', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#fff' }}>{(p.displayName[0] || '?').toUpperCase()}</div>}
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0B0F17', minWidth: 0, overflowWrap: 'anywhere' }}>{p.displayName}</h1>
              <span style={apPill(p.profileStatus === 'Approved' ? 'rgba(169,220,192,.4)' : 'rgba(242,197,138,.4)', p.profileStatus === 'Approved' ? '#2f7d52' : '#9c6b1c')}>{p.profileStatus === 'Approved' ? t('Godkänd') : p.profileStatus}</span>
              {p.emailVerified
                ? <span style={apPill('rgba(169,220,192,.35)', '#2f7d52')}>✓ {t('E-post verifierad')}</span>
                : <span style={apPill('rgba(255,90,77,.15)', '#c0392b')}>✗ {t('E-post EJ verifierad')}</span>}
              {p.tikTokConnected && <span style={apPill('rgba(183,188,200,.25)', '#3c4250')}>{p.tikTokOAuth ? '✓ TikTok OAuth' : '⚠ TikTok manuell'}</span>}
            </div>
            <div style={{ ...apMuted, marginTop: 6, overflowWrap: 'anywhere' }}>{p.email} · {p.country} · {t('Medlem sedan')} {formatDate(p.registeredAt)}</div>
            {p.bio && <p style={{ margin: '10px 0 0', fontSize: '.9rem', color: '#3c4250', lineHeight: 1.55 }}>{p.bio}</p>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {p.profileTags.map((tg) => <span key={tg} style={apPill('rgba(237,225,255,.7)', '#6a4ea8')}>{tg}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Verksamhet ── */}
      <div style={apCard}>
        <h3 style={{ margin: '0 0 10px', fontSize: '.95rem', fontWeight: 800 }}>{t('Verksamhet på plattformen')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {apStat({ label: t('Aktiva uppdrag'), value: p.activeAssignments })}
          {apStat({ label: t('Slutförda'), value: p.completedAssignments })}
          {apStat({ label: t('Verifierade views'), value: formatNumber(p.totalVerifiedViews) })}
          {apStat({ label: t('Intjänat'), value: formatCurrency(p.totalEarned) })}
          {apStat({ label: t('Utbetalt'), value: formatCurrency(p.totalPaidOut) })}
          {apStat({ label: t('Betyg'), value: p.reviewCount > 0 ? `${p.averageRating.toFixed(1)} / 5` : '–', sub: p.reviewCount > 0 ? `${p.reviewCount} ${t('omdömen')}` : t('inga omdömen') })}
          {apStat({ label: t('Portfölj'), value: p.portfolioCount })}
        </div>
        {engagementless && <div style={{ ...apMuted, marginTop: 8 }}>{t('Ingen kampanjaktivitet ännu.')}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14, minWidth: 0 }}>
        {/* ── Konto ── */}
        <div style={{ ...apCard, marginBottom: 0 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '.95rem', fontWeight: 800 }}>{t('Konto')}</h3>
          {apRow({ label: t('E-post'), value: <>{p.email} {p.emailVerified ? '✓' : `— ${t('ej verifierad')}`}</> })}
          {apRow({ label: t('Kontostatus'), value: p.accountStatus })}
          {apRow({ label: t('Inloggning via'), value: p.authProvider || t('E-post + lösenord') })}
          {apRow({ label: t('Registrerad'), value: formatDate(p.registeredAt) })}
          {apRow({ label: t('Senast inloggad'), value: p.lastLoginAt ? formatDate(p.lastLoginAt) : '–' })}
          {apRow({ label: t('Födelsedatum'), value: p.dateOfBirth ?? '–' })}
          {apRow({ label: t('Språk'), value: p.language })}
          {apRow({ label: t('Medlems-ID'), value: <code style={{ fontSize: '.75rem' }}>{p.userId}</code> })}
        </div>

        {/* ── Räckvidd & kanaler ── */}
        <div style={{ ...apCard, marginBottom: 0 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '.95rem', fontWeight: 800 }}>{t('Räckvidd & kanaler')}</h3>
          {apRow({ label: t('Kategori'), value: p.category })}
          {apRow({ label: t('Uppgivna följare'), value: formatNumber(p.followerCount) })}
          {apRow({ label: t('Uppgivna snitt-views'), value: p.averageViews ? formatNumber(p.averageViews) : '–' })}
          {apRow({ label: 'TikTok', value: p.tikTokUsername ? <a href={`https://www.tiktok.com/@${p.tikTokUsername}`} target="_blank" rel="noopener noreferrer" style={{ color: '#9c4f31' }}>@{p.tikTokUsername} ({formatNumber(p.tikTokFollowerCount)} {t('följare')})</a> : '–' })}
          {apRow({ label: t('TikTok-koppling'), value: p.tikTokConnected ? (p.tikTokOAuth ? t('OAuth (verifierad)') : t('Manuell (overifierad)')) : t('Ej kopplad') })}
          {apRow({ label: t('Senast synkad'), value: p.tikTokLastSync ? formatDate(p.tikTokLastSync) : '–' })}
          {apRow({ label: 'Instagram', value: p.instagramUsername ? `@${p.instagramUsername} (${formatNumber(p.instagramFollowerCount)})` : '–' })}
          {apRow({ label: t('Webbplats'), value: p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ color: '#9c4f31' }}>{p.website}</a> : '–' })}
          {apRow({ label: t('Utbetalningsmetod'), value: p.payoutMethodConfigured ? (p.payoutMethod || t('Konfigurerad')) : t('Ej konfigurerad') })}
        </div>
      </div>

      {/* ── Identitetsverifiering ── */}
      <div style={{ ...apCard, marginTop: 14 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '.95rem', fontWeight: 800 }}>{t('Identitetsverifiering')}</h3>
        {p.selfieUrl ? (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <img src={p.selfieUrl} alt={t('Selfie för verifiering')} style={{ width: '100%', maxWidth: 200, borderRadius: 16, border: '1px solid rgba(241,168,143,.3)' }} />
            <div style={{ flex: '1 1 220px', minWidth: 0, fontSize: '.85rem', color: '#5c6270', lineHeight: 1.6 }}>
              {t('Jämför selfien med profilbilden och TikTok-kontots innehåll innan du godkänner. Selfien visas aldrig offentligt.')}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#c0392b' }}>⚠ {t('Ingen selfie inskickad — kontot skapades innan kravet infördes.')}</div>
        )}
      </div>

      {/* ── Moderation ── */}
      <div style={{ ...apCard, marginTop: 14 }}>
        {p.profileStatus === 'Approved' ? (
          <div style={{ color: '#2f7d52', fontWeight: 700, fontSize: '.9rem' }}>✓ {t('Denna profil är godkänd')}</div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => approveCreator.mutate()} disabled={approveCreator.isPending}
              style={{ padding: '.6rem 1.4rem', borderRadius: 980, background: 'linear-gradient(135deg,#3dbb77,#2f9d5b)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}>
              {approveCreator.isPending ? t('Godkänner…') : t('Godkänn konto')}
            </button>
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('Anledning vid nekande')}
              style={{ flex: 1, minWidth: 200, padding: '.6rem .9rem', borderRadius: 12, border: '1px solid rgba(241,168,143,.35)', fontSize: '.85rem', fontFamily: 'inherit' }} />
            <button onClick={() => rejectCreator.mutate(rejectReason || 'Avvisad av admin')} disabled={rejectCreator.isPending}
              style={{ padding: '.6rem 1.4rem', borderRadius: 980, background: 'rgba(255,90,77,.12)', color: '#c0392b', border: '1px solid rgba(255,90,77,.3)', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}>
              {rejectCreator.isPending ? t('Nekar…') : t('Neka konto')}
            </button>
          </div>
        )}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(241,168,143,.2)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => {
              if (!armedDelete) { setArmedDelete(true); setTimeout(() => setArmedDelete(false), 4000); return; }
              deleteAccount.mutate();
            }}
            disabled={deleteAccount.isPending}
            style={{ padding: '.55rem 1.3rem', borderRadius: 980, background: armedDelete ? '#cf4b4b' : 'transparent', color: armedDelete ? '#fff' : '#cf4b4b', border: '1px solid rgba(207,75,75,.45)', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', maxWidth: '100%' }}
          >
            {deleteAccount.isPending ? t('Raderar…') : armedDelete ? t('Säker? Klicka igen för att radera') : t('Radera konto')}
          </button>
          <span style={{ ...apMuted, flex: '1 1 220px', minWidth: 0 }}>{t('Mjuk radering — kontot släcks och loggas ut, kampanjhistorik bevaras för spårbarhet.')}</span>
        </div>
      </div>
    </div>
  );
}


export function AdminDashboardPage() {
  const [page] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout } = useAuthStore();
  const section = (searchParams.get('section') as AdminSection) || 'overview';
  const filter = (searchParams.get('tab') as 'all' | 'pending' | 'active' | 'rejected') || 'pending';
  const creatorId = searchParams.get('creatorId');

  const setSection = (sec: AdminSection) => setSearchParams({ section: sec, tab: sec === 'users' ? 'pending' : '' });
  const setFilter = (f: 'all' | 'pending' | 'active' | 'rejected') => setSearchParams({ section, tab: f });

  const { data, isLoading, isError, error } = usePendingUsers(page);
  const approveUser = useApproveUser();
  const rejectUser = useRejectUser();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [threadUser, setThreadUser] = useState<{ id: string; name: string } | null>(null);
  const { data: supportThreads } = useAdminUnreadThreads();
  const unreadReplies = (supportThreads ?? []).reduce((s, th) => s + th.unreadFromUser, 0);
  const triggerSync = useTriggerSync();

  const { data: campaignsData, isLoading: campaignsLoading, isError: campaignsError, error: campaignsErrorObj } = usePendingCampaigns(page);
  const approveCampaign = useApproveCampaign();
  const rejectCampaign = useRejectCampaign();
  const [rejectingCampaignId, setRejectingCampaignId] = useState<string | null>(null);
  const [campaignRejectReason, setCampaignRejectReason] = useState('');
  const deleteUser = useDeleteUser();
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  // Two-step inline confirm: first click arms, second deletes.
  const handleDeleteUser = (id: string) => {
    if (armedDeleteId !== id) {
      setArmedDeleteId(id);
      setTimeout(() => setArmedDeleteId((cur) => (cur === id ? null : cur)), 4000);
      return;
    }
    setArmedDeleteId(null);
    deleteUser.mutate(id);
  };

  // Profile view renders instead of the dashboard — placed AFTER every hook:
  // an early return above any hook makes React render fewer hooks than the
  // previous pass and crash with minified error #300.
  if (creatorId) {
    return <AdminCreatorProfilePage creatorId={creatorId} onBack={() => setSearchParams({ section, tab: filter })} />;
  }

  const filteredUsers = (data?.data || []).filter(u => {
    if (filter === 'pending') return u.status === 'PendingVerification';
    if (filter === 'active') return u.status === 'Active';
    if (filter === 'rejected') return u.status === 'Deactivated';
    return true;
  });

  const handleApprove = async (id: string) => {
    await approveUser.mutateAsync(id);
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    await rejectUser.mutateAsync({ id, reason: rejectReason });
    setRejectingId(null);
    setRejectReason('');
  };

  const handleCampaignReject = async (id: string) => {
    if (!campaignRejectReason.trim()) return;
    await rejectCampaign.mutateAsync({ id, reason: campaignRejectReason });
    setRejectingCampaignId(null);
    setCampaignRejectReason('');
  };

  const pendingCampaignCount = campaignsData?.totalCount ?? 0;
  const pendingUserCount = (data?.data || []).filter(u => u.status === 'PendingVerification').length;

  return (
    <div className="vy-app" style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <h1 style={s.title}>{t('Adminpanel')}</h1>
            <p style={{ color: '#6E7480', fontSize: '.9rem' }}>{t('Statistik, användare, kampanjer, utbetalningar och säkerhet')}</p>
          </div>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <button
            onClick={() => triggerSync.mutate()}
            disabled={triggerSync.isPending}
            style={{ padding: '.5rem 1rem', borderRadius: '.5rem', border: '1px solid #7c3aed', background: '#6a4ea8', color: '#fff', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600, opacity: triggerSync.isPending ? 0.6 : 1 }}>
            {triggerSync.isPending ? t('⏳ Synkar…') : triggerSync.isSuccess ? t('✓ Synk startad!') : t('🔄 Synka TikTok nu')}
            </button>
            <button
              onClick={() => { logout(); window.location.href = '/login'; }}
              style={{ padding: '.5rem 1rem', borderRadius: 980, border: '1px solid rgba(207,75,75,.4)', background: 'rgba(255,255,255,.7)', color: '#cf4b4b', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>
              {t('Logga ut')}
            </button>
          </div>
        </div>

        {/* Section selector */}
        <div style={{ display: 'flex', gap: '.6rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {([
            ['overview', t('Översikt'), 0],
            ['users', t('Användare'), pendingUserCount + unreadReplies],
            ['campaigns', t('Kampanjer'), pendingCampaignCount],
            ['payouts', t('Utbetalningar'), 0],
            ['fraud', t('Säkerhet'), 0],
            ['audit', t('Logg'), 0],
          ] as [AdminSection, string, number][]).map(([key, label, badge]) => (
            <button key={key} onClick={() => setSection(key)} style={s.tab(section === key)}>
              {label}
              {badge > 0 && <span style={{ marginLeft: 6, background: '#C26A4A', color: '#fff', borderRadius: 999, fontSize: '.7rem', fontWeight: 700, padding: '1px 7px' }}>{badge}</span>}
            </button>
          ))}
        </div>

        {section === 'overview' && <AdminOverviewSection />}
        {section === 'payouts' && <AdminPayoutsSection />}
        {section === 'fraud' && <AdminFraudSection />}
        {section === 'audit' && <AdminAuditSection />}

        {/* ── Users section ── */}
        {section === 'users' && (
          <>
            <AdminCreateAdminCard />
            <AdminBroadcastCard />
            <AdminSupportInboxCard onOpenThread={(id, name) => setThreadUser({ id, name })} />
            {threadUser && (
              <AdminUserThreadModal userId={threadUser.id} userName={threadUser.name} onClose={() => setThreadUser(null)} />
            )}
            <div style={s.tabs}>
              <button style={s.tab(filter === 'pending')} onClick={() => setFilter('pending')}>{t('Väntande')}</button>
              <button style={s.tab(filter === 'active')} onClick={() => setFilter('active')}>{t('Godkända')}</button>
              <button style={s.tab(filter === 'rejected')} onClick={() => setFilter('rejected')}>{t('Avvisade')}</button>
              <button style={s.tab(filter === 'all')} onClick={() => setFilter('all')}>{t('Alla')}</button>
            </div>

            {isLoading && <div style={s.empty}>{t('Laddar…')}</div>}

            {isError && (
              <div style={s.empty as React.CSSProperties}>
                <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>{t('Kunde inte hämta användare')}</p>
                <p style={{ fontSize: '.875rem' }}>{getApiErrorMessage(error, t('Okänt fel'))}</p>
              </div>
            )}

            {!isLoading && !isError && filteredUsers.length === 0 && (
              <div style={s.empty as React.CSSProperties}>
                <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>{t('Inga användare att visa')}</p>
                <p style={{ fontSize: '.875rem' }}>
                  {filter === 'pending' ? t('Alla ansökningar har hanterats!') : t('Inga användare matchar filtret.')}
                </p>
              </div>
            )}

            {!isError && filteredUsers.map((user) => (
              <div key={user.id} style={s.card}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem', marginBottom: '1rem' }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 0, overflowWrap: 'anywhere' }}>
                        {user.role === 'Creator' ? user.displayName || user.email : user.companyName || user.email}
                      </span>
                      <span style={s.roleBadge(user.role)}>{user.role}</span>
                      <span style={s.badge(user.status)}>{user.status === 'PendingVerification' ? t('Väntande') : user.status === 'Active' ? t('Godkänd') : t('Avvisad')}</span>
                    </div>
                    <p style={{ color: '#6E7480', fontSize: '.8rem', overflowWrap: 'anywhere' }}>
                      {user.email} · {t('Registrerad')} {new Date(user.createdAt).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {user.role === 'Creator' && (
                      <button
                        onClick={() => setSearchParams({ section: 'users', tab: filter, creatorId: user.id })}
                        style={{ background: 'none', border: '1px solid #7c3aed', borderRadius: '.5rem', padding: '.5rem .75rem', color: '#6a4ea8', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}
                      >
                        {t('Visa profil')}
                      </button>
                    )}
                    {user.role !== 'Admin' && (
                      <button
                        onClick={() => setThreadUser({ id: user.id, name: user.role === 'Creator' ? user.displayName || user.email : user.companyName || user.email })}
                        style={{ background: 'none', border: '1px solid #C26A4A', borderRadius: '.5rem', padding: '.5rem .75rem', color: '#C26A4A', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}
                      >
                        ✉️ {t('Meddela')}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                      style={{ background: 'none', border: '1px solid #1e1e2e', borderRadius: '.5rem', padding: '.5rem .75rem', color: '#6E7480', cursor: 'pointer', fontSize: '.8rem' }}
                    >
                      {expandedId === user.id ? t('Dölj') : t('Detaljer')}
                    </button>
                  </div>
                </div>

                {expandedId === user.id && (
                  <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: '1rem', marginBottom: '1rem' }}>
                    {(user.avatarUrl || user.authProvider) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                        {user.avatarUrl && <img src={user.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: user.role === 'Brand' ? 10 : '50%', objectFit: 'cover', border: '1px solid #1e1e2e', flex: '0 0 44px' }} />}
                        {user.authProvider && <span style={{ fontSize: '.75rem', color: '#2f9d5b', border: '1px solid rgba(47,157,91,.4)', borderRadius: 999, padding: '3px 10px' }}>{t('E-post verifierad via')} {user.authProvider}</span>}
                      </div>
                    )}
                    {user.role === 'Creator' && (
                      <>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Visningsnamn:')}</span><span style={s.detailValue}>{user.displayName || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>TikTok:</span><span style={s.detailValue}>{user.tikTokUsername ? `@${user.tikTokUsername}` : '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Följare:')}</span><span style={s.detailValue}>{user.followerCount ? user.followerCount.toLocaleString('sv-SE') : '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>Instagram:</span><span style={s.detailValue}>{user.instagramUsername ? `@${user.instagramUsername}` : '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Webbplats:')}</span><span style={s.detailValue}>{user.website || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Kategori:')}</span><span style={s.detailValue}>{user.category || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Födelsedatum:')}</span><span style={s.detailValue}>{user.dateOfBirth || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>Bio:</span><span style={s.detailValue}>{user.bio || '–'}</span></div>
                      </>
                    )}
                    {user.role === 'Brand' && (
                      <>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Företagsnamn:')}</span><span style={s.detailValue}>{user.companyName || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Org.nummer:')}</span><span style={s.detailValue}>{user.organizationNumber || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Bransch:')}</span><span style={s.detailValue}>{user.industry || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Webbplats:')}</span><span style={s.detailValue}>{user.website || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>{t('Telefon:')}</span><span style={s.detailValue}>{user.contactPhone || '–'}</span></div>
                      </>
                    )}
                    {user.rejectionReason && (
                      <div style={s.detailRow}><span style={s.detailLabel}>{t('Avvisningsorsak:')}</span><span style={{ ...s.detailValue, color: '#cf4b4b' }}>{user.rejectionReason}</span></div>
                    )}
                  </div>
                )}

                {user.status === 'PendingVerification' && (
                  <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button style={s.btnApprove} onClick={() => handleApprove(user.id)} disabled={approveUser.isPending}>
                      {t('✓ Godkänn')}
                    </button>
                    {rejectingId === user.id ? (
                      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flex: '1 1 260px', minWidth: 0, flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t('Orsak till avvisning…')}
                          style={{ flex: '1 1 160px', minWidth: 0, borderRadius: '.5rem', border: '1px solid #1e1e2e', background: '#FFF4EC', padding: '.5rem .75rem', fontSize: '.8rem', color: '#0B0F17', outline: 'none' }}
                        />
                        <button style={s.btnReject} onClick={() => handleReject(user.id)} disabled={rejectUser.isPending || !rejectReason.trim()}>
                          {t('Avvisa')}
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectReason(''); }} style={{ background: 'none', border: 'none', color: '#6E7480', cursor: 'pointer', fontSize: '.8rem' }}>
                          {t('Avbryt')}
                        </button>
                      </div>
                    ) : (
                      <button style={{ ...s.btnReject, background: 'transparent', border: '1px solid #f44336', color: '#cf4b4b' }} onClick={() => setRejectingId(user.id)}>
                        {t('✕ Avvisa')}
                      </button>
                    )}
                  </div>
                )}
                {user.role !== 'Admin' && (
                  <div style={{ marginTop: '.6rem' }}>
                    <button
                      style={{ ...s.btnReject, background: armedDeleteId === user.id ? '#cf4b4b' : 'transparent', color: armedDeleteId === user.id ? '#fff' : '#cf4b4b', border: '1px solid rgba(207,75,75,.45)' }}
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={deleteUser.isPending}
                    >
                      {armedDeleteId === user.id ? t('Säker? Klicka igen för att radera') : t('Radera konto')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── Campaigns section ── */}
        {section === 'campaigns' && (
          <>
            <p style={{ color: '#6E7480', fontSize: '.875rem', marginBottom: '1rem' }}>
              {t('Kampanjer som väntar på granskning innan de publiceras.')}
            </p>

            {campaignsLoading && <div style={s.empty}>{t('Laddar…')}</div>}

            {campaignsError && (
              <div style={s.empty as React.CSSProperties}>
                <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>{t('Kunde inte hämta kampanjer')}</p>
                <p style={{ fontSize: '.875rem' }}>{getApiErrorMessage(campaignsErrorObj, t('Okänt fel'))}</p>
              </div>
            )}

            {!campaignsLoading && !campaignsError && (campaignsData?.data || []).length === 0 && (
              <div style={s.empty as React.CSSProperties}>
                <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>{t('Inga kampanjer att granska')}</p>
                <p style={{ fontSize: '.875rem' }}>{t('Alla kampanjer är hanterade!')}</p>
              </div>
            )}

            {!campaignsError && (campaignsData?.data || []).map((campaign) => (
              <div key={campaign.id} style={s.card}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem', marginBottom: '.75rem' }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', minWidth: 0, overflowWrap: 'anywhere' }}>{campaign.name}</span>
                      <span style={{ display: 'inline-block', padding: '.25rem .75rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 600, background: 'rgba(255,216,199,.55)', color: '#b07d1c' }}>{t('Granskas')}</span>
                    </div>
                    <p style={{ color: '#6E7480', fontSize: '.8rem', overflowWrap: 'anywhere' }}>
                      {campaign.brandName} · {campaign.category} · {campaign.country}
                    </p>
                    <p style={{ color: '#6E7480', fontSize: '.8rem', marginTop: '.25rem', overflowWrap: 'anywhere' }}>
                      Budget: {formatCurrency(campaign.budget)} · Max {campaign.maxCreators} creators · {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                    </p>
                    <p style={{ color: '#5a5a7a', fontSize: '.75rem', marginTop: '.25rem' }}>
                      {t('Skickad in')} {new Date(campaign.createdAt).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button style={s.btnApprove} onClick={() => approveCampaign.mutateAsync(campaign.id)} disabled={approveCampaign.isPending}>
                    {t('✓ Godkänn')}
                  </button>
                  {rejectingCampaignId === campaign.id ? (
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flex: '1 1 260px', minWidth: 0, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={campaignRejectReason}
                        onChange={(e) => setCampaignRejectReason(e.target.value)}
                        placeholder={t('Orsak till avvisning…')}
                        style={{ flex: '1 1 160px', minWidth: 0, borderRadius: '.5rem', border: '1px solid #1e1e2e', background: '#FFF4EC', padding: '.5rem .75rem', fontSize: '.8rem', color: '#0B0F17', outline: 'none' }}
                      />
                      <button style={s.btnReject} onClick={() => handleCampaignReject(campaign.id)} disabled={rejectCampaign.isPending || !campaignRejectReason.trim()}>
                        {t('Neka')}
                      </button>
                      <button onClick={() => { setRejectingCampaignId(null); setCampaignRejectReason(''); }} style={{ background: 'none', border: 'none', color: '#6E7480', cursor: 'pointer', fontSize: '.8rem' }}>
                        {t('Avbryt')}
                      </button>
                    </div>
                  ) : (
                    <button style={{ ...s.btnReject, background: 'transparent', border: '1px solid #f44336', color: '#cf4b4b' }} onClick={() => setRejectingCampaignId(campaign.id)}>
                      {t('✕ Neka')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
