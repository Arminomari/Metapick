import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useTriggerSync } from '@/hooks/api';
import type { ApiResponse, PagedResult } from '@/types';

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
  const filter = (searchParams.get('tab') as 'all' | 'pending' | 'active' | 'rejected') || 'pending';
  const setFilter = (f: 'all' | 'pending' | 'active' | 'rejected') => setSearchParams({ tab: f });
  const { data, isLoading } = usePendingUsers(page);
  const approveUser = useApproveUser();
  const rejectUser = useRejectUser();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const triggerSync = useTriggerSync();

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

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Admin Panel</h1>
            <p style={{ color: '#8b8ba3', fontSize: '.9rem' }}>Hantera användarregistreringar</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => triggerSync.mutate()}
              disabled={triggerSync.isPending}
              style={{ padding: '.5rem 1rem', borderRadius: '.5rem', border: '1px solid #7c3aed', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600, opacity: triggerSync.isPending ? 0.6 : 1 }}>
              {triggerSync.isPending ? '⏳ Synkar...' : triggerSync.isSuccess ? '✓ Synk startad!' : '🔄 Synka TikTok nu'}
            </button>
            <span style={{ fontSize: '.875rem', color: '#8b8ba3' }}>
              {(data?.data || []).filter(u => u.status === 'PendingVerification').length} väntande
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button style={s.tab(filter === 'pending')} onClick={() => setFilter('pending')}>Väntande</button>
          <button style={s.tab(filter === 'active')} onClick={() => setFilter('active')}>Godkända</button>
          <button style={s.tab(filter === 'rejected')} onClick={() => setFilter('rejected')}>Avvisade</button>
          <button style={s.tab(filter === 'all')} onClick={() => setFilter('all')}>Alla</button>
        </div>

        {isLoading && (
          <div style={s.empty}>Laddar...</div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <div style={s.empty as React.CSSProperties}>
            <p style={{ fontSize: '1.25rem', marginBottom: '.5rem' }}>Inga användare att visa</p>
            <p style={{ fontSize: '.875rem' }}>
              {filter === 'pending' ? 'Alla ansökningar har hanterats!' : 'Inga användare matchar filtret.'}
            </p>
          </div>
        )}

        {filteredUsers.map((user) => (
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
      </div>
    </div>
  );
}
