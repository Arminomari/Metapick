import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import { useToast, CardSkeleton } from '@/components/vyrle/Toast';
import type { ApiResponse } from '@/types';

interface CommunityMember {
  creatorProfileId: string; displayName: string; avatarUrl?: string | null; tikTokUsername?: string | null; tikTokFollowers: number;
  status: string; source: string; joinedAt: string; lifetimeEarned: number; lifetimeViews: number; collaborations: number;
}

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];

export function BrandCommunityPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [armed, setArmed] = useState<string | null>(null);
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['brand-community'],
    queryFn: async () => (await api.get<ApiResponse<CommunityMember[]>>('/brand/community/members')).data.data,
  });
  const remove = useMutation({
    mutationFn: async (creatorProfileId: string) => (await api.delete(`/brand/community/members/${creatorProfileId}`)).data.data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand-community'] }); toast.push(t('Medlemmen är borttagen ur communityn'), 'success'); },
  });

  const handleRemove = (id: string) => {
    if (armed !== id) { setArmed(id); setTimeout(() => setArmed((cur) => (cur === id ? null : cur)), 4000); return; }
    setArmed(null);
    remove.mutate(id);
  };

  const auto = members.filter((m) => m.source === 'AutoQualified').length;
  const invited = members.filter((m) => m.source === 'Invited').length;
  const totalEarned = members.reduce((s, m) => s + m.lifetimeEarned, 0);

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Ditt')} <em>{t('community')}</em></h1>
          <p className="page-sub">{t('Creators du samarbetat med kvalificerar automatiskt. Medlemskap = rätten att hämta ur kranen. Bjud in fler från Hitta creators.')}</p>
        </div>
        <Link to="/brand/creators" className="btn-apply" style={{ width: 'auto', padding: '12px 22px', textDecoration: 'none' }}>＋ {t('Bjud in creators')}</Link>
      </div>

      <div className="stat-row">
        <div className="card stat"><div className="top"><div><div className="lbl">{t('Medlemmar')}</div><div className="val">{members.length}</div></div></div></div>
        <div className="card stat"><div className="top"><div><div className="lbl">{t('Auto-kvalificerade')}</div><div className="val">{auto}</div></div></div></div>
        <div className="card stat"><div className="top"><div><div className="lbl">{t('Inbjudna')}</div><div className="val">{invited}</div></div></div></div>
        <div className="card stat"><div className="top"><div><div className="lbl">{t('Utbetalt till communityn')}</div><div className="val">{formatCurrency(totalEarned)}</div></div></div></div>
      </div>

      <div className="card">
        <div className="sec-head"><h3>{t('Medlemmar')}</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{members.length} {t('st')}</span></div>
        {isLoading ? <CardSkeleton rows={3} /> : members.length ? members.map((m) => (
          <div key={m.creatorProfileId} className="list-row" style={{ gap: 14 }}>
            <span role="button" tabIndex={0} onClick={() => navigate(`/brand/creators/${m.creatorProfileId}`)} style={{ cursor: 'pointer', flex: '0 0 auto' }}>
              {m.avatarUrl
                ? <img src={m.avatarUrl} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover' }} />
                : <span className="mono" style={{ background: grad(m.displayName) }}>{(m.displayName[0] || '?').toUpperCase()}</span>}
            </span>
            <div className="row-main" style={{ flex: 1, minWidth: 0 }}>
              <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/brand/creators/${m.creatorProfileId}`)}>{m.displayName}</span>
                {m.tikTokUsername && <span style={{ fontSize: 12, color: '#9c4f31', fontWeight: 600 }}>@{m.tikTokUsername}</span>}
                <span className={`badge ${m.source === 'AutoQualified' ? 'green' : 'grey'}`}>{m.source === 'AutoQualified' ? t('Auto-kvalificerad') : t('Inbjuden')}</span>
              </div>
              <div className="s">{formatNumber(m.tikTokFollowers)} {t('följare')} · {m.collaborations} {t('samarbeten')} · {formatNumber(m.lifetimeViews)} views · {formatCurrency(m.lifetimeEarned)} {t('utbetalt')} · {t('medlem sedan')} {formatDate(m.joinedAt)}</div>
            </div>
            <button className="btn-outline" style={{ padding: '8px 14px', fontSize: 12.5, ...(armed === m.creatorProfileId ? { borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 600 } : {}) }} onClick={() => handleRemove(m.creatorProfileId)} disabled={remove.isPending}>
              {armed === m.creatorProfileId ? t('Säker? Klicka igen') : t('Ta bort')}
            </button>
          </div>
        )) : (
          <div style={{ textAlign: 'center', padding: '44px 24px' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga medlemmar ännu')}</div>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 460, marginInline: 'auto' }}>{t('Kör en första kampanj så kvalificerar creators in automatiskt — eller bjud in direkt från Hitta creators.')}</div>
            <Link to="/brand/creators" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 22px', marginTop: 16, textDecoration: 'none' }}>{t('Hitta creators')}</Link>
          </div>
        )}
      </div>
    </section>
  );
}
