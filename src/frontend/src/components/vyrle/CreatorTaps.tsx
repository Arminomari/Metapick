import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types';

export interface MyCommunity {
  brandProfileId: string; brandName: string; brandLogoUrl?: string | null; source: string; joinedAt: string; hasActiveTap: boolean;
}

export function useMyCommunities() {
  return useQuery({
    queryKey: ['my-communities'],
    queryFn: async () => (await api.get<ApiResponse<MyCommunity[]>>('/creator/communities')).data.data,
    refetchInterval: 120000,
  });
}

export interface CreatorTap {
  tapId: string; assignmentId: string; brandProfileId: string; brandName: string; brandLogoUrl?: string | null;
  name: string; tapStatus: string; membershipStatus: string;
  brief: string; contentInstructions?: string | null; requiredHashtag: string;
  cpm: number; payoutCapPerVideo?: number | null; monthlyCapPerCreator?: number | null;
  myMonthEarned: number; myMonthViews: number; myLifetimeEarned: number;
  tapMonthBudget: number; tapMonthSpent: number; briefUpdatedAt?: string | null;
}

export function useCreatorTaps() {
  return useQuery({
    queryKey: ['creator-taps'],
    queryFn: async () => (await api.get<ApiResponse<CreatorTap[]>>('/creator/taps')).data.data,
    refetchInterval: 60000,
  });
}

const Meter = ({ value, max, color }: { value: number; max: number; color?: string }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ height: 8, borderRadius: 980, background: 'rgba(241,168,143,.18)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 980, background: color ?? 'linear-gradient(90deg,#FFD8C7,#F1A88F)', transition: 'width .5s' }} />
    </div>
  );
};

/** Dashboard card: the taps this creator can draw from. */
export function CreatorTapsSection() {
  const navigate = useNavigate();
  const { data: taps = [], isLoading } = useCreatorTaps();
  const { data: communities = [] } = useMyCommunities();
  const waiting = communities.filter((c) => !taps.some((tp) => tp.brandProfileId === c.brandProfileId));
  if (isLoading || (taps.length === 0 && communities.length === 0)) return null;

  return (
    <div className="card" style={{ marginTop: 18, background: 'linear-gradient(160deg,#fff,#FFF6F0)' }}>
      <div className="vperf-head" style={{ flexWrap: 'wrap', gap: '4px 12px' }}>
        <h3>💧 {t('Dina kranar')}</h3>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{taps.length ? t('Löpande ersättning — publicera när du vill') : t('Du är medlem i företags-communities — kranarna dyker upp här när de öppnas')}</span>
        <Link to="/creator/taps" className="view-all" style={{ marginLeft: 'auto' }}>{t('Visa alla kranar')} →</Link>
      </div>
      {waiting.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: taps.length ? 12 : 6 }}>
          {waiting.map((c) => (
            <div key={c.brandProfileId} onClick={() => navigate(`/creator/brands/${c.brandProfileId}`)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 8px', borderRadius: 980, border: '1px solid rgba(241,168,143,.28)', background: '#fff', maxWidth: '100%' }}>
              {c.brandLogoUrl
                ? <img src={c.brandLogoUrl} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flex: '0 0 26px' }} />
                : <span style={{ width: 26, height: 26, borderRadius: '50%', flex: '0 0 26px', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>{(c.brandName[0] || '?').toUpperCase()}</span>}
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.brandName}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>· {c.hasActiveTap ? t('kranen öppen') : t('kranen ej öppnad ännu')}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 14, marginTop: 6 }}>
        {taps.map((tap) => {
          const open = tap.tapStatus === 'Active' && tap.membershipStatus === 'Active';
          const tapPct = tap.tapMonthBudget > 0 ? Math.round((tap.tapMonthSpent / tap.tapMonthBudget) * 100) : 0;
          return (
            <div key={tap.tapId} onClick={() => navigate(`/creator/assignments/${tap.assignmentId}`)} style={{ cursor: 'pointer', border: '1px solid rgba(241,168,143,.25)', borderRadius: 18, padding: 16, background: '#fff', boxShadow: '0 8px 24px rgba(180,120,90,.07)', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {tap.brandLogoUrl
                  ? <img src={tap.brandLogoUrl} alt="" style={{ width: 38, height: 38, flex: '0 0 38px', borderRadius: 11, objectFit: 'cover' }} />
                  : <span style={{ width: 38, height: 38, flex: '0 0 38px', borderRadius: 11, background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>{(tap.brandName[0] || '?').toUpperCase()}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tap.brandName}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', wordBreak: 'break-word' }}>{tap.cpm} kr / 1 000 views{tap.monthlyCapPerCreator ? ` · ${t('max')} ${formatCurrency(tap.monthlyCapPerCreator)}/${t('mån')}` : ''}</div>
                </div>
                <span className={`badge ${open ? 'green' : 'grey'}`} style={{ flexShrink: 0 }}>{open ? t('Öppen') : t('Pausad')}</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: '"Fraunces",serif', fontSize: 24, fontWeight: 700 }}>{formatCurrency(tap.myMonthEarned)}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('denna månad')} · {formatNumber(tap.myMonthViews)} views</span>
              </div>
              {tap.monthlyCapPerCreator ? <div style={{ marginTop: 6 }}><Meter value={tap.myMonthEarned} max={tap.monthlyCapPerCreator} /></div> : null}
              <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 10px' }}>
                <span>{t('Kranen')}: {tapPct}% {t('använd')}</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>#{tap.requiredHashtag}</span>
              </div>
              <div style={{ marginTop: 4 }}><Meter value={tap.tapMonthSpent} max={tap.tapMonthBudget} color={tapPct >= 100 ? 'linear-gradient(90deg,#ff8a7a,#cf4b4b)' : 'linear-gradient(90deg,#cdb8f2,#9c7de0)'} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Banner on the assignment detail page when the assignment belongs to a tap. */
export function TapBanner({ assignmentId }: { assignmentId: string }) {
  const { data: taps = [] } = useCreatorTaps();
  const tap = taps.find((x) => x.assignmentId === assignmentId);
  if (!tap) return null;
  const open = tap.tapStatus === 'Active' && tap.membershipStatus === 'Active';
  const tapPct = tap.tapMonthBudget > 0 ? Math.round((tap.tapMonthSpent / tap.tapMonthBudget) * 100) : 0;

  return (
    <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(160deg,#fff,#FFF6F0)', border: '1px solid rgba(241,168,143,.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden>💧</span>
        <div style={{ flex: 1, minWidth: 'min(100%, 220px)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, wordBreak: 'break-word' }}>{t('Kranen')} · {tap.brandName} <span className={`badge ${open ? 'green' : 'grey'}`} style={{ marginLeft: 6 }}>{open ? t('Öppen') : t('Pausad')}</span></div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2, wordBreak: 'break-word' }}>
            {t('Löpande')}: <strong>{tap.cpm} kr / 1 000 views</strong>
            {tap.payoutCapPerVideo ? ` · ${t('max')} ${formatCurrency(tap.payoutCapPerVideo)} / video` : ''}
            {tap.monthlyCapPerCreator ? ` · ${t('max')} ${formatCurrency(tap.monthlyCapPerCreator)} / ${t('mån')}` : ''}
            {' · '}{t('Kranen är')} {tapPct}% {t('använd denna månad')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: '0 1 auto', minWidth: 0 }}>
          <div style={{ fontFamily: '"Fraunces",serif', fontSize: 24, fontWeight: 700 }}>{formatCurrency(tap.myMonthEarned)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', wordBreak: 'break-word' }}>{t('denna månad')} · {formatCurrency(tap.myLifetimeEarned)} {t('totalt')}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 13, background: 'rgba(255,255,255,.75)', border: '1px solid rgba(241,168,143,.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('Stående brief')}{tap.briefUpdatedAt ? ` · ${t('uppdaterad')} ${formatDate(tap.briefUpdatedAt)}` : ''}</div>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{tap.brief}</p>
        {tap.contentInstructions && <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{tap.contentInstructions}</p>}
        <div style={{ marginTop: 8 }}><Link to={`/creator/brands/${tap.brandProfileId}`} style={{ fontSize: 12.5, fontWeight: 700, color: '#9c4f31' }}>{t('Se företagets uppdateringar')} →</Link></div>
      </div>
    </div>
  );
}
