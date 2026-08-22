import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { statusLabel, t } from '@/lib/i18n';
import {
  useCreatorAssignments, useCreatorPayouts, useCreatorProfile,
  useBrowseCampaigns, useProfile, useUserReviews,
} from '@/hooks/api';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import type { AssignmentListItem } from '@/types';
import { PageSkeleton } from '@/components/vyrle/Toast';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
  'linear-gradient(135deg,#e8c6d1,#b88aa0)',
];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function campTag(status: string, goalReached?: boolean) {
  if (goalReached) return <span className="vcamp-tag" style={{ background: 'rgba(169,220,192,.45)', color: '#2f7d52' }}>{t('MÅL UPPNÅTT')} ✓</span>;
  const s = (status || '').toLowerCase();
  if (s.includes('review')) return <span className="vcamp-tag rev">{t('UNDER GRANSKNING')}</span>;
  if (s === 'active') return <span className="vcamp-tag prog">{t('PÅGÅR')}</span>;
  return <span className="vcamp-tag up">{statusLabel(status).toUpperCase()}</span>;
}

type Metric = 'views' | 'earnings' | 'clicks';
const mVal = (a: AssignmentListItem, m: Metric) => m === 'views' ? a.totalVerifiedViews : m === 'earnings' ? a.currentPayoutAmount : a.totalTrackedClicks;
const mFmt = (n: number, m: Metric) => m === 'earnings' ? formatCurrency(n) : formatNumber(n);

export function CreatorStudioDashboard() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>('views');

  const { data: assignmentsRes, isLoading } = useCreatorAssignments();
  const { data: payoutsRes } = useCreatorPayouts();
  const { data: profile } = useCreatorProfile();
  const { data: user } = useProfile();
  const { data: reviews } = useUserReviews(user?.id ?? '');
  const { data: browseRes } = useBrowseCampaigns();

  if (isLoading) return <PageSkeleton />;

  const assignments = assignmentsRes?.data ?? [];
  const payouts = payoutsRes?.data ?? [];
  const browse = browseRes?.data ?? [];

  const active = assignments.filter((a) => a.status === 'Active');
  const totalViews = assignments.reduce((s, a) => s + a.totalVerifiedViews, 0);
  const totalClicks = assignments.reduce((s, a) => s + a.totalTrackedClicks, 0);
  const totalEarned = assignments.reduce((s, a) => s + a.currentPayoutAmount, 0);
  const paidOut = payouts.filter((p) => ['Completed', 'Approved', 'Processing'].includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const pending = Math.max(0, totalEarned - paidOut);
  const name = profile?.displayName || t('kreatör');

  // chart: real per-campaign values for selected metric, ascending
  const chartCamps = [...assignments].sort((a, b) => mVal(a, metric) - mVal(b, metric)).slice(-8);
  const vals = chartCamps.map((a) => mVal(a, metric));
  const W = 900, H = 300, top = 14, bot = 14;
  const max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => {
    const x = vals.length === 1 ? W / 2 : (i / (vals.length - 1)) * W;
    const y = top + (1 - v / max) * (H - top - bot);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = pts.length ? `${line} L${W},${H} L0,${H} Z` : '';
  const totalMetric = assignments.reduce((s, a) => s + mVal(a, metric), 0);
  const avgMetric = assignments.length ? Math.round(totalMetric / assignments.length) : 0;
  const topCamp = chartCamps[chartCamps.length - 1];

  // reputation donut from real reviews
  const avgStars = reviews?.averageStars ?? 0;
  const reviewCount = reviews?.totalReviews ?? 0;
  const score = Math.round((avgStars / 5) * 100);
  const C = 314.159, dash = (score / 100) * C;
  const repWord = score >= 90 ? t('Utmärkt') : score >= 75 ? t('Mycket bra') : score >= 50 ? t('Bra') : reviewCount ? t('På väg upp') : t('Ny');

  return (
    <section className="view active reveal" data-view="overview">
      {/* HERO */}
      <div className="hero">
        <div className="hero-grain" />
        <div className="hero-glow" />
        <svg className="hero-star" viewBox="0 0 220 220" fill="none" aria-hidden="true">
          <defs>
            <radialGradient id="hsGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFF4EC" /><stop offset="30%" stopColor="#FFD8C7" stopOpacity=".9" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></radialGradient>
            <linearGradient id="hsCore" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="60%" stopColor="#FBEEF6" /><stop offset="100%" stopColor="#EDE1FF" /></linearGradient>
          </defs>
          <circle cx="110" cy="110" r="104" fill="url(#hsGlow)" />
          <path d="M110 20 C118 78 142 102 200 110 C142 118 118 142 110 200 C102 142 78 118 20 110 C78 102 102 78 110 20Z" fill="url(#hsCore)" />
          <path d="M110 58 C115 95 125 105 162 110 C125 115 115 125 110 162 C105 125 95 115 58 110 C95 105 105 95 110 58Z" fill="#fff" opacity=".96" />
        </svg>
        <div className="hero-inner">
          <div className="hero-eyebrow"><span className="hero-live" /> Creator Studio · Live</div>
          <h1 className="hero-title">{t('Välkommen tillbaka,')} <em>{name}</em></h1>
          <p className="hero-sub">{t('Verifierade views, upplupna utbetalningar och vad som är live på ditt konto just nu.')}</p>
          <div className="hero-kpis">
            <div className="hero-kpi"><div className="hk-v">{formatNumber(totalViews)}</div><div className="hk-l">{t('Verifierade views')}</div></div>
            <div className="hero-kpi-sep" />
            <div className="hero-kpi"><div className="hk-v hk-money"><span>{formatCurrency(totalEarned)}</span></div><div className="hk-l">{t('Totalt upplupet')}</div></div>
            <div className="hero-kpi-sep" />
            <div className="hero-kpi"><div className="hk-v">{formatCurrency(pending)}</div><div className="hk-l">{t('Väntande utbetalning')}</div></div>
            <div className="hero-kpi-sep" />
            <div className="hero-kpi"><div className="hk-v">{active.length}</div><div className="hk-l">{t('Aktiva kampanjer')}</div></div>
          </div>
        </div>
      </div>

      {/* TOP: performance + reputation */}
      <div className="vtop">
        <div className="card vperf">
          <div className="vperf-head"><h3>{t('Prestation per kampanj')}</h3><span className="vchip">{assignments.length} {t('kampanjer')}</span></div>
          <div className="vmetric-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <button className={`vmetric${metric === 'views' ? ' active' : ''}`} onClick={() => setMetric('views')}><span className="vm-l">Views</span><span className="vm-v">{formatNumber(totalViews)}</span></button>
            <button className={`vmetric${metric === 'earnings' ? ' active' : ''}`} onClick={() => setMetric('earnings')}><span className="vm-l">{t('Intäkter')}</span><span className="vm-v">{formatCurrency(totalEarned)}</span></button>
            <button className={`vmetric${metric === 'clicks' ? ' active' : ''}`} onClick={() => setMetric('clicks')}><span className="vm-l">{t('Klick')}</span><span className="vm-v">{formatNumber(totalClicks)}</span></button>
          </div>
          {vals.length >= 2 ? (
            <>
              <div className="vchart">
                <div className="vchart-y"><span>{mFmt(max, metric)}</span><span>{mFmt(Math.round(max * .75), metric)}</span><span>{mFmt(Math.round(max * .5), metric)}</span><span>{mFmt(Math.round(max * .25), metric)}</span><span>0</span></div>
                <div className="vchart-plot">
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="vchart-svg">
                    <defs>
                      <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F1A88F" stopOpacity=".42" /><stop offset="55%" stopColor="#F1A88F" stopOpacity=".12" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></linearGradient>
                      <linearGradient id="perfLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FFD0BC" /><stop offset="55%" stopColor="#F1A88F" /><stop offset="100%" stopColor="#E68A6E" /></linearGradient>
                    </defs>
                    {[57.6, 129.6, 201.6].map((y) => <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#F5EDE4" strokeWidth="1" />)}
                    <path d={areaPath} fill="url(#perfFill)" />
                    <path d={line} fill="none" stroke="url(#perfLine)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                    {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="5.5" fill="#fff" stroke="#F1A88F" strokeWidth="3" />}
                  </svg>
                  <div className="vchart-x">{chartCamps.map((a) => <span key={a.id} style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.campaignName}</span>)}</div>
                </div>
              </div>
              <div className="vperf-foot">
                <div className="vf-stat"><div className="vf-l">{t('Toppkampanj')}</div><div className="vf-v">{topCamp?.campaignName ?? '—'}</div></div>
                <div className="vf-stat"><div className="vf-l">{t('Snitt')}</div><div className="vf-v">{mFmt(avgMetric, metric)}</div></div>
                <div className="vf-stat"><div className="vf-l">{t('Totalt')}</div><div className="vf-v">{mFmt(totalMetric, metric)}</div></div>
                <Link className="vperf-link" to="/creator/assignments" style={{ margin: 0 }}>{t('Alla kampanjer')} <Arrow /></Link>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px 10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{t('Inte tillräckligt med data ännu')}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{t('När du har ett par kampanjer igång visas din prestationsöversikt här.')}</div>
              <Link to="/creator/browse" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 20px', marginTop: 16 }}>{t('Upptäck kampanjer')}</Link>
            </div>
          )}
        </div>

        <div className="card vrep">
          <div className="vperf-head"><h3>{t('Creator-betyg')}</h3></div>
          <div className="vrep-donut">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(183,188,200,.25)" strokeWidth="9" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#perfLine)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} transform="rotate(-90 60 60)" />
            </svg>
            <div className="vrep-center"><div className="vrep-num">{reviewCount ? avgStars.toFixed(1) : '—'}</div><div className="vrep-lbl" style={{ color: reviewCount ? '#2f9d5b' : 'var(--muted)' }}>{repWord}</div></div>
          </div>
          <div className="vrep-rows">
            {reviews?.reviews?.length ? reviews.reviews.slice(0, 4).map((r) => (
              <div key={r.id} className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg></span>{r.reviewerName}<b>{r.stars}/5</b></div>
            )) : (
              <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--muted)' }}>{t('Betyg från företag på slutförda kampanjer visas här.')}</div>
            )}
          </div>
          <Link className="vperf-link" to="/creator/portfolio">{t('Bygg din portfölj')} <Arrow /></Link>
        </div>
      </div>

      {/* SPLIT: active + discover */}
      <div className="vcsplit">
        <div className="card vcamps">
          <div className="vperf-head"><h3>{t('Aktiva kampanjer')}</h3></div>
          {active.length ? active.slice(0, 5).map((a) => (
            <div key={a.id} className="vcamp" onClick={() => navigate(`/creator/assignments/${a.id}`)}>
              <span className="vcamp-thumb" style={{ background: grad(a.campaignName) }}><span className="brand-mono">{initial(a.campaignName)}</span></span>
              <div className="vcamp-main"><div className="vcamp-b">{a.campaignName}</div><div className="vcamp-m">{t('Tilldelad')} {formatDate(a.assignedAt)}</div>{campTag(a.status, a.goalReached)}</div>
              <div className="vcamp-end"><div className="vcamp-k">Views</div><div className="vcamp-v">{formatNumber(a.totalVerifiedViews)}</div></div>
              <div className="vcamp-end"><div className="vcamp-k">{t('Intjänat')}</div><div className="vcamp-v">{formatCurrency(a.currentPayoutAmount)}</div></div>
            </div>
          )) : (
            <div style={{ padding: '34px 10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{t('Inga aktiva kampanjer ännu')}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{t('Bläddra bland öppna kampanjer och ansök till de som passar din röst.')}</div>
              <Link to="/creator/browse" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 20px', marginTop: 16 }}>{t('Upptäck kampanjer')}</Link>
            </div>
          )}
          {active.length > 0 && <Link className="vperf-link center" to="/creator/assignments">{t('Visa alla kampanjer')} <Arrow /></Link>}
        </div>

        <div className="card vdisc">
          <div className="vperf-head"><h3>{t('Upptäck kampanjer')} <span className="vdisc-ai">{t('Öppna nu')}</span></h3></div>
          <div className="vdisc-sub">{t('Öppna kampanjer på din marknad, redo att söka.')}</div>
          {browse.length ? browse.slice(0, 4).map((c) => {
            const filled = c.maxCreators ? Math.round(((c.maxCreators - c.spotsLeft) / c.maxCreators) * 100) : 0;
            return (
              <div key={c.id} className="vdisc-item" onClick={() => navigate('/creator/browse')}>
                <span className="vdisc-score" style={{ '--s': filled } as React.CSSProperties}>
                  <svg viewBox="0 0 44 44" className="vdisc-ring"><circle className="vdisc-track" cx="22" cy="22" r="19" /><circle className="vdisc-prog" cx="22" cy="22" r="19" stroke="url(#perfLine)" /></svg>
                  <span className="vdisc-num">{c.spotsLeft}</span>
                </span>
                <div className="vdisc-main"><div className="vdisc-b">{c.name}</div><div className="vdisc-m">{c.brandName} · {c.category} · {c.payoutSummary}</div><div className="vdisc-why">{c.spotsLeft} {t('av')} {c.maxCreators} {t('platser kvar')} · min {formatNumber(c.minViews)} views</div></div>
              </div>
            );
          }) : (
            <div style={{ padding: '34px 10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{t('Inga öppna kampanjer just nu')}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{t('Nya kampanjer på din marknad visas här när de går live.')}</div>
            </div>
          )}
          {browse.length > 0 && <Link className="vperf-link center" to="/creator/browse">{t('Utforska alla kampanjer')} <Arrow /></Link>}
        </div>
      </div>

      <BrandFeedSection />
    </section>
  );
}

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
