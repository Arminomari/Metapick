import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useTriggerSync } from '@/hooks/api';
import type { ApiResponse, PagedResult } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

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

const s = {
  page: { minHeight: '100vh', background: '#0a0a0f', color: '#fafafa', padding: 'clamp(1rem, 4vw, 2rem)' } as React.CSSProperties,
  container: { maxWidth: 1100, margin: '0 auto' } as React.CSSProperties,
  header: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem' } as React.CSSProperties,
  title: { fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 700 } as React.CSSProperties,
  tabs: { display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '2rem' } as React.CSSProperties,
  tab: (active: boolean) => ({ padding: '.5rem 1rem', borderRadius: '.5rem', border: '1px solid #1e1e2e', background: active ? '#e84393' : 'transparent', color: active ? '#fff' : '#8b8ba3', cursor: 'pointer', fontSize: '.875rem', fontWeight: 600 }) as React.CSSProperties,
  card: { background: '#14141f', border: '1px solid #1e1e2e', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1rem' } as React.CSSProperties,
  badge: (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      PendingVerification: { bg: 'rgba(255,193,7,.15)', color: '#ffc107' },
      Active: { bg: 'rgba(76,175,80,.15)', color: '#4caf50' },
      Deactivated: { bg: 'rgba(244,67,54,.15)', color: '#f44336' },
    };
    const c = colors[status] || colors.PendingVerification;
    return { display: 'inline-block', padding: '.25rem .75rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 600, background: c.bg, color: c.color } as React.CSSProperties;
  },
  roleBadge: (role: string) => {
    const c = role === 'Creator' ? { bg: 'rgba(232,67,147,.15)', color: '#e84393' } : { bg: 'rgba(124,58,237,.15)', color: '#7c3aed' };
    return { display: 'inline-block', padding: '.25rem .75rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 600, background: c.bg, color: c.color } as React.CSSProperties;
  },
  btnApprove: { padding: '.5rem 1.25rem', borderRadius: '.5rem', background: '#4caf50', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' } as React.CSSProperties,
  btnReject: { padding: '.5rem 1.25rem', borderRadius: '.5rem', background: '#f44336', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' } as React.CSSProperties,
  detailRow: { display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.5rem', fontSize: '.875rem' } as React.CSSProperties,
  detailLabel: { color: '#8b8ba3', minWidth: 160 } as React.CSSProperties,
  detailValue: { color: '#fafafa' } as React.CSSProperties,
  empty: { textAlign: 'center', padding: '4rem 0', color: '#8b8ba3' } as React.CSSProperties,
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

export function AdminDashboardPage() {
  const [page] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const section = (searchParams.get('section') as 'users' | 'campaigns') || 'users';
  const filter = (searchParams.get('tab') as 'all' | 'pending' | 'active' | 'rejected') || 'pending';

  const setSection = (s: 'users' | 'campaigns') => setSearchParams({ section: s, tab: s === 'users' ? 'pending' : '' });
  const setFilter = (f: 'all' | 'pending' | 'active' | 'rejected') => setSearchParams({ section, tab: f });

  const { data, isLoading, isError, error } = usePendingUsers(page);
  const approveUser = useApproveUser();
  const rejectUser = useRejectUser();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const triggerSync = useTriggerSync();

  const { data: campaignsData, isLoading: campaignsLoading, isError: campaignsError, error: campaignsErrorObj } = usePendingCampaigns(page);
  const approveCampaign = useApproveCampaign();
  const rejectCampaign = useRejectCampaign();
  const [rejectingCampaignId, setRejectingCampaignId] = useState<string | null>(null);
  const [campaignRejectReason, setCampaignRejectReason] = useState('');

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
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Admin Panel</h1>
            <p style={{ color: '#8b8ba3', fontSize: '.9rem' }}>Hantera användare och kampanjer</p>
          </div>
          <button
            onClick={() => triggerSync.mutate()}
            disabled={triggerSync.isPending}
            style={{ padding: '.5rem 1rem', borderRadius: '.5rem', border: '1px solid #7c3aed', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600, opacity: triggerSync.isPending ? 0.6 : 1 }}>
            {triggerSync.isPending ? '⏳ Synkar...' : triggerSync.isSuccess ? '✓ Synk startad!' : '🔄 Synka TikTok nu'}
          </button>
        </div>

        {/* Section selector */}
        <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setSection('users')}
            style={{
              padding: '.625rem 1.25rem', borderRadius: '.625rem', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer',
              border: section === 'users' ? '2px solid #e84393' : '2px solid #1e1e2e',
              background: section === 'users' ? 'rgba(232,67,147,.12)' : 'transparent',
              color: section === 'users' ? '#e84393' : '#8b8ba3',
              display: 'flex', alignItems: 'center', gap: '.5rem',
            }}>
            👤 Användare
            {pendingUserCount > 0 && (
              <span style={{ background: '#e84393', color: '#fff', borderRadius: 999, fontSize: '.7rem', fontWeight: 700, padding: '1px 7px' }}>{pendingUserCount}</span>
            )}
          </button>
          <button
            onClick={() => setSection('campaigns')}
            style={{
              padding: '.625rem 1.25rem', borderRadius: '.625rem', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer',
              border: section === 'campaigns' ? '2px solid #7c3aed' : '2px solid #1e1e2e',
              background: section === 'campaigns' ? 'rgba(124,58,237,.12)' : 'transparent',
              color: section === 'campaigns' ? '#7c3aed' : '#8b8ba3',
              display: 'flex', alignItems: 'center', gap: '.5rem',
            }}>
            📢 Kampanjer
            {pendingCampaignCount > 0 && (
              <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 999, fontSize: '.7rem', fontWeight: 700, padding: '1px 7px' }}>{pendingCampaignCount}</span>
            )}
          </button>
        </div>

        {/* ── Users section ── */}
        {section === 'users' && (
          <>
            <div style={s.tabs}>
              <button style={s.tab(filter === 'pending')} onClick={() => setFilter('pending')}>Väntande</button>
              <button style={s.tab(filter === 'active')} onClick={() => setFilter('active')}>Godkända</button>
              <button style={s.tab(filter === 'rejected')} onClick={() => setFilter('rejected')}>Avvisade</button>
              <button style={s.tab(filter === 'all')} onClick={() => setFilter('all')}>Alla</button>
            </div>

            {isLoading && <div style={s.empty}>Laddar...</div>}

            {isError && (
              <div style={s.empty as React.CSSProperties}>
                <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>Kunde inte hämta användare</p>
                <p style={{ fontSize: '.875rem' }}>{getApiErrorMessage(error, 'Okänt fel')}</p>
              </div>
            )}

            {!isLoading && !isError && filteredUsers.length === 0 && (
              <div style={s.empty as React.CSSProperties}>
                <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>Inga användare att visa</p>
                <p style={{ fontSize: '.875rem' }}>
                  {filter === 'pending' ? 'Alla ansökningar har hanterats!' : 'Inga användare matchar filtret.'}
                </p>
              </div>
            )}

            {!isError && filteredUsers.map((user) => (
              <div key={user.id} style={s.card}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                        {user.role === 'Creator' ? user.displayName || user.email : user.companyName || user.email}
                      </span>
                      <span style={s.roleBadge(user.role)}>{user.role}</span>
                      <span style={s.badge(user.status)}>{user.status === 'PendingVerification' ? 'Väntande' : user.status === 'Active' ? 'Godkänd' : 'Avvisad'}</span>
                    </div>
                    <p style={{ color: '#8b8ba3', fontSize: '.8rem' }}>
                      {user.email} · Registrerad {new Date(user.createdAt).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                    style={{ background: 'none', border: '1px solid #1e1e2e', borderRadius: '.5rem', padding: '.5rem .75rem', color: '#8b8ba3', cursor: 'pointer', fontSize: '.8rem' }}
                  >
                    {expandedId === user.id ? 'Dölj detaljer' : 'Visa detaljer'}
                  </button>
                </div>

                {expandedId === user.id && (
                  <div style={{ borderTop: '1px solid #1e1e2e', paddingTop: '1rem', marginBottom: '1rem' }}>
                    {user.role === 'Creator' && (
                      <>
                        <div style={s.detailRow}><span style={s.detailLabel}>Visningsnamn:</span><span style={s.detailValue}>{user.displayName || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>TikTok:</span><span style={s.detailValue}>{user.tikTokUsername ? `@${user.tikTokUsername}` : '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>Kategori:</span><span style={s.detailValue}>{user.category || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>Födelsedatum:</span><span style={s.detailValue}>{user.dateOfBirth || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>Bio:</span><span style={s.detailValue}>{user.bio || '–'}</span></div>
                      </>
                    )}
                    {user.role === 'Brand' && (
                      <>
                        <div style={s.detailRow}><span style={s.detailLabel}>Företagsnamn:</span><span style={s.detailValue}>{user.companyName || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>Org.nummer:</span><span style={s.detailValue}>{user.organizationNumber || '–'}</span></div>
                        <div style={s.detailRow}><span style={s.detailLabel}>Telefon:</span><span style={s.detailValue}>{user.contactPhone || '–'}</span></div>
                      </>
                    )}
                    {user.rejectionReason && (
                      <div style={s.detailRow}><span style={s.detailLabel}>Avvisningsorsak:</span><span style={{ color: '#f44336' }}>{user.rejectionReason}</span></div>
                    )}
                  </div>
                )}

                {user.status === 'PendingVerification' && (
                  <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                    <button style={s.btnApprove} onClick={() => handleApprove(user.id)} disabled={approveUser.isPending}>
                      ✓ Godkänn
                    </button>
                    {rejectingId === user.id ? (
                      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flex: 1 }}>
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Orsak till avvisning..."
                          style={{ flex: 1, borderRadius: '.5rem', border: '1px solid #1e1e2e', background: '#0a0a0f', padding: '.5rem .75rem', fontSize: '.8rem', color: '#fafafa', outline: 'none' }}
                        />
                        <button style={s.btnReject} onClick={() => handleReject(user.id)} disabled={rejectUser.isPending || !rejectReason.trim()}>
                          Avvisa
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectReason(''); }} style={{ background: 'none', border: 'none', color: '#8b8ba3', cursor: 'pointer', fontSize: '.8rem' }}>
                          Avbryt
                        </button>
                      </div>
                    ) : (
                      <button style={{ ...s.btnReject, background: 'transparent', border: '1px solid #f44336', color: '#f44336' }} onClick={() => setRejectingId(user.id)}>
                        ✕ Avvisa
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── Campaigns section ── */}
        {section === 'campaigns' && (
          <>
            <p style={{ color: '#8b8ba3', fontSize: '.875rem', marginBottom: '1rem' }}>
              Kampanjer som väntar på granskning innan de publiceras.
            </p>

            {campaignsLoading && <div style={s.empty}>Laddar...</div>}

            {campaignsError && (
              <div style={s.empty as React.CSSProperties}>
                <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>Kunde inte hämta kampanjer</p>
                <p style={{ fontSize: '.875rem' }}>{getApiErrorMessage(campaignsErrorObj, 'Okänt fel')}</p>
              </div>
            )}

            {!campaignsLoading && !campaignsError && (campaignsData?.data || []).length === 0 && (
              <div style={s.empty as React.CSSProperties}>
                <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>Inga kampanjer att granska</p>
                <p style={{ fontSize: '.875rem' }}>Alla kampanjer är hanterade!</p>
              </div>
            )}

            {!campaignsError && (campaignsData?.data || []).map((campaign) => (
              <div key={campaign.id} style={s.card}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem', marginBottom: '.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.25rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{campaign.name}</span>
                      <span style={{ display: 'inline-block', padding: '.25rem .75rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 600, background: 'rgba(255,193,7,.15)', color: '#ffc107' }}>Granskas</span>
                    </div>
                    <p style={{ color: '#8b8ba3', fontSize: '.8rem' }}>
                      {campaign.brandName} · {campaign.category} · {campaign.country}
                    </p>
                    <p style={{ color: '#8b8ba3', fontSize: '.8rem', marginTop: '.25rem' }}>
                      Budget: {formatCurrency(campaign.budget)} · Max {campaign.maxCreators} creators · {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                    </p>
                    <p style={{ color: '#5a5a7a', fontSize: '.75rem', marginTop: '.25rem' }}>
                      Skickad in {new Date(campaign.createdAt).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                  <button style={s.btnApprove} onClick={() => approveCampaign.mutateAsync(campaign.id)} disabled={approveCampaign.isPending}>
                    ✓ Godkänn
                  </button>
                  {rejectingCampaignId === campaign.id ? (
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flex: 1 }}>
                      <input
                        type="text"
                        value={campaignRejectReason}
                        onChange={(e) => setCampaignRejectReason(e.target.value)}
                        placeholder="Orsak till avvisning..."
                        style={{ flex: 1, borderRadius: '.5rem', border: '1px solid #1e1e2e', background: '#0a0a0f', padding: '.5rem .75rem', fontSize: '.8rem', color: '#fafafa', outline: 'none' }}
                      />
                      <button style={s.btnReject} onClick={() => handleCampaignReject(campaign.id)} disabled={rejectCampaign.isPending || !campaignRejectReason.trim()}>
                        Neka
                      </button>
                      <button onClick={() => { setRejectingCampaignId(null); setCampaignRejectReason(''); }} style={{ background: 'none', border: 'none', color: '#8b8ba3', cursor: 'pointer', fontSize: '.8rem' }}>
                        Avbryt
                      </button>
                    </div>
                  ) : (
                    <button style={{ ...s.btnReject, background: 'transparent', border: '1px solid #f44336', color: '#f44336' }} onClick={() => setRejectingCampaignId(campaign.id)}>
                      ✕ Neka
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
