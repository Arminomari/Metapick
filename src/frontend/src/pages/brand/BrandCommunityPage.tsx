import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCreatorSearch } from '@/hooks/api';
import { MessageCreatorModal } from '@/components/ui/MessageCreatorModal';
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
  const [inviting, setInviting] = useState(false);
  const [messaging, setMessaging] = useState<{ id: string; name: string } | null>(null);
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

  const respond = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) =>
      (await api.post(`/brand/community/requests/${id}?approve=${approve}`)).data.data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['brand-community'] });
      qc.invalidateQueries({ queryKey: ['action-counts'] });
      toast.push(v.approve ? t('Creatorn är nu medlem') : t('Ansökan till communityn nekad'), 'success');
    },
  });

  const requests = members.filter((m) => m.status === 'Requested');
  const auto = members.filter((m) => m.source === 'AutoQualified').length;
  const invited = members.filter((m) => m.source === 'Invited').length;
  const active = members.filter((m) => m.status !== 'Requested');
  const totalEarned = members.reduce((s, m) => s + m.lifetimeEarned, 0);

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Ditt')} <em>{t('community')}</em></h1>
          <p className="page-sub">{t('Creators du samarbetat med kvalificerar automatiskt. Medlemskap = rätten att hämta ur kranen. Bjud in fler från Hitta creators.')}</p>
        </div>
        <button type="button" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setInviting(true)}>＋ {t('Bjud in creators')}</button>
      </div>

      <div className="stat-row">
        <div className="card stat"><div className="top"><div><div className="lbl">{t('Medlemmar')}</div><div className="val">{members.length}</div></div></div></div>
        <div className="card stat"><div className="top"><div><div className="lbl">{t('Auto-kvalificerade')}</div><div className="val">{auto}</div></div></div></div>
        <div className="card stat"><div className="top"><div><div className="lbl">{t('Inbjudna')}</div><div className="val">{invited}</div></div></div></div>
        <div className="card stat"><div className="top"><div><div className="lbl">{t('Utbetalt till communityn')}</div><div className="val">{formatCurrency(totalEarned)}</div></div></div></div>
      </div>

      {requests.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(212,155,46,.4)', background: 'linear-gradient(160deg,#fff,#FFF9F0)' }}>
          <div className="sec-head"><h3>{t('Ansökningar till communityn')}</h3><span className="vy-badge pend">{requests.length}</span></div>
          {requests.map((m) => (
            <div key={m.creatorProfileId} className="list-row" style={{ gap: 14, flexWrap: 'wrap' }}>
              <span role="button" tabIndex={0} onClick={() => navigate(`/brand/creators/${m.creatorProfileId}`)} style={{ cursor: 'pointer', flex: '0 0 auto' }}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover' }} />
                  : <span className="mono" style={{ background: grad(m.displayName) }}>{(m.displayName[0] || '?').toUpperCase()}</span>}
              </span>
              <div className="row-main" style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div className="t">{m.displayName}{m.tikTokUsername && <span style={{ fontSize: 12, color: '#9c4f31', fontWeight: 600, marginLeft: 8 }}>@{m.tikTokUsername}</span>}</div>
                <div className="s" style={{ whiteSpace: 'normal' }}>{formatNumber(m.tikTokFollowers)} {t('följare')} · {t('vill gå med i din community')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: '0 0 auto' }}>
                <button className="btn-apply" style={{ width: 'auto', padding: '8px 16px', fontSize: 12.5 }} onClick={() => respond.mutate({ id: m.creatorProfileId, approve: true })} disabled={respond.isPending}>✓ {t('Godkänn')}</button>
                <button className="btn-outline" style={{ padding: '8px 16px', fontSize: 12.5 }} onClick={() => respond.mutate({ id: m.creatorProfileId, approve: false })} disabled={respond.isPending}>{t('Neka')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="sec-head"><h3>{t('Medlemmar')}</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{active.length} {t('st')}</span></div>
        {isLoading ? <CardSkeleton rows={3} /> : active.length ? active.map((m) => (
          <div key={m.creatorProfileId} className="list-row" style={{ gap: 14, flexWrap: 'wrap' }}>
            <span role="button" tabIndex={0} onClick={() => navigate(`/brand/creators/${m.creatorProfileId}`)} style={{ cursor: 'pointer', flex: '0 0 auto' }}>
              {m.avatarUrl
                ? <img src={m.avatarUrl} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover' }} />
                : <span className="mono" style={{ background: grad(m.displayName) }}>{(m.displayName[0] || '?').toUpperCase()}</span>}
            </span>
            <div className="row-main" style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/brand/creators/${m.creatorProfileId}`)}>{m.displayName}</span>
                {m.tikTokUsername && <span style={{ fontSize: 12, color: '#9c4f31', fontWeight: 600 }}>@{m.tikTokUsername}</span>}
                <span className={`badge ${m.source === 'AutoQualified' ? 'green' : 'grey'}`}>{m.source === 'AutoQualified' ? t('Auto-kvalificerad') : t('Inbjuden')}</span>
              </div>
              <div className="s" style={{ whiteSpace: 'normal' }}>{formatNumber(m.tikTokFollowers)} {t('följare')} · {m.collaborations} {t('samarbeten')} · {formatNumber(m.lifetimeViews)} views · {formatCurrency(m.lifetimeEarned)} {t('utbetalt')} · {t('medlem sedan')} {formatDate(m.joinedAt)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: '0 0 auto' }}>
              <button className="btn-outline" style={{ padding: '8px 14px', fontSize: 12.5 }} onClick={() => setMessaging({ id: m.creatorProfileId, name: m.displayName })}>
                ✎ {t('Skriv')}
              </button>
              <button className="btn-outline" style={{ padding: '8px 14px', fontSize: 12.5, ...(armed === m.creatorProfileId ? { borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 600 } : {}) }} onClick={() => handleRemove(m.creatorProfileId)} disabled={remove.isPending}>
                {armed === m.creatorProfileId ? t('Säker? Klicka igen') : t('Ta bort')}
              </button>
            </div>
          </div>
        )) : (
          <div style={{ textAlign: 'center', padding: '44px 24px' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga medlemmar ännu')}</div>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 460, marginInline: 'auto' }}>{t('Kör en första kampanj så kvalificerar creators in automatiskt — eller bjud in direkt från Hitta creators.')}</div>
            <button type="button" className="btn-apply" style={{ width: 'auto', padding: '11px 22px', marginTop: 16 }} onClick={() => setInviting(true)}>{t('Bjud in creators')}</button>
          </div>
        )}
      </div>

      {inviting && <InviteCreatorsModal existing={members.map((m) => m.creatorProfileId)} onClose={() => setInviting(false)} />}
      {messaging && <MessageCreatorModal creatorProfileId={messaging.id} creatorName={messaging.name} onClose={() => setMessaging(null)} />}
    </section>
  );
}

// ── Bulk invite: pick many creators at once ────────────────────────
function InviteCreatorsModal({ existing, onClose }: { existing: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const { data, isLoading } = useCreatorSearch({ page: 1 });
  const already = new Set(existing);
  const all = (data?.data ?? []).filter((c) => !already.has(c.id));
  const shown = q.trim()
    ? all.filter((c) => `${c.displayName} ${c.category ?? ''} ${c.tikTokUsername ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    : all;

  const invite = useMutation({
    mutationFn: async () => (await api.post('/brand/community/invite-many', { creatorProfileIds: picked })).data.data as number,
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['brand-community'] });
      toast.push(`${n} ${n === 1 ? t('creator inbjuden') : t('creators inbjudna')}`, 'success');
      onClose();
    },
    onError: () => toast.push(t('Kunde inte bjuda in'), 'error'),
  });

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,23,.45)', backdropFilter: 'blur(3px)', zIndex: 80 }} aria-hidden />
      <div role="dialog" aria-modal="true" style={{ position: 'fixed', zIndex: 81, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#fff,#FFF9F5)', borderRadius: 24, border: '1px solid rgba(241,168,143,.35)', boxShadow: '0 30px 80px rgba(11,15,23,.28)', padding: 'clamp(18px, 5vw, 24px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{t('Bjud in till din community')}</h2>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{t('Medlemmar kan hämta ur kranen och får dina uppdateringar.')}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Stäng')} style={{ border: 'none', background: 'rgba(183,188,200,.2)', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 16, color: '#5a606d', flex: '0 0 auto' }}>×</button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Sök på namn, nisch eller @handle…')}
          style={{ width: '100%', marginTop: 14, borderRadius: 13, border: '1px solid rgba(241,168,143,.3)', background: 'rgba(255,255,255,.85)', padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', minWidth: 0 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '12px 0 8px' }}>
          <button type="button" className="btn-outline" style={{ width: 'auto', padding: '7px 14px', fontSize: 12.5 }}
            onClick={() => setPicked(picked.length === shown.length ? [] : shown.map((c) => c.id))}>
            {picked.length === shown.length && shown.length > 0 ? t('Avmarkera alla') : t('Välj alla')}
          </button>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{picked.length} {t('valda')}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 120, display: 'grid', gap: 8 }}>
          {isLoading ? <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>{t('Laddar…')}</div>
            : shown.length ? shown.map((c) => {
              const on = picked.includes(c.id);
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', minWidth: 0, background: on ? 'rgba(255,227,211,.55)' : 'rgba(255,255,255,.7)', border: `1px solid ${on ? 'rgba(241,168,143,.5)' : 'rgba(241,168,143,.22)'}` }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(c.id)} style={{ flex: '0 0 auto', width: 18, height: 18 }} />
                  {c.avatarUrl
                    ? <img src={c.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: 11, objectFit: 'cover', flex: '0 0 36px' }} />
                    : <span className="mono" style={{ background: grad(c.displayName), flex: '0 0 auto' }}>{(c.displayName[0] || '?').toUpperCase()}</span>}
                  <span style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.displayName}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{c.category}{c.tikTokUsername ? ` · @${c.tikTokUsername}` : ''} · {formatNumber(c.followerCount ?? 0)} {t('följare')}</span>
                  </span>
                </label>
              );
            }) : <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>{t('Inga fler creators att bjuda in.')}</div>}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" className="btn-apply" style={{ width: 'auto', padding: '12px 24px' }} disabled={picked.length === 0 || invite.isPending} onClick={() => invite.mutate()}>
            {invite.isPending ? t('Bjuder in…') : `${t('Bjud in')} ${picked.length > 0 ? `(${picked.length})` : ''}`}
          </button>
          <button type="button" className="btn-outline" style={{ width: 'auto', padding: '12px 24px' }} onClick={onClose}>{t('Avbryt')}</button>
        </div>
      </div>
    </>
  );
}
