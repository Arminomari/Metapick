import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCreatorAssignments, useCreatorPayouts, useCreatorProfile,
  useNotifications, useBrowseCampaigns, useProfile, useUserReviews,
} from '@/hooks/api';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import type { AssignmentListItem } from '@/types';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
  'linear-gradient(135deg,#e8c6d1,#b88aa0)',
];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function statusBadge(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return <span className="vy-badge peach">ACTIVE</span>;
  if (s.includes('review') || s.includes('pending')) return <span className="vy-badge lilac">{status.toUpperCase()}</span>;
  if (s === 'completed' || s === 'paid') return <span className="vy-badge green">{status.toUpperCase()}</span>;
  if (s.includes('reject')) return <span className="vy-badge red">{status.toUpperCase()}</span>;
  return <span className="vy-badge grey">{status.toUpperCase()}</span>;
}

const Svg = ({ d, sw = 1.7 }: { d: React.ReactNode; sw?: number }) =>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const I = {
  views: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  earn: <><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  camp: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12 4 4L19 7" />,
};

type Metric = 'views' | 'earnings' | 'clicks';
const metricVal = (a: AssignmentListItem, m: Metric) =>
  m === 'views' ? a.totalVerifiedViews : m === 'earnings' ? a.currentPayoutAmount : a.totalTrackedClicks;
const metricFmt = (n: number, m: Metric) => (m === 'earnings' ? formatCurrency(n) : formatNumber(n));

/** Build an area + line path from real per-campaign values (ascending for a clean rising shape). */
function chartPaths(values: number[], W: number, H: number) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? W / 2 : (i / (values.length - 1)) * W;
    const y = H - (v / max) * (H - 10) - 4;
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  return { line, area, max, pts };
}

export function CreatorStudioDashboard() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>('views');

  const { data: assignmentsRes, isLoading } = useCreatorAssignments();
  const { data: payoutsRes } = useCreatorPayouts();
  const { data: profile } = useCreatorProfile();
  const { data: user } = useProfile();
  const { data: reviews } = useUserReviews(user?.id ?? '');
  const { data: notifRes } = useNotifications();
  const { data: browseRes } = useBrowseCampaigns();

  if (isLoading) return <div className="vy-spinner" />;

  const assignments = assignmentsRes?.data ?? [];
  const payouts = payoutsRes?.data ?? [];
  const notifs = notifRes?.data ?? [];
  const browse = browseRes?.data ?? [];

  const active = assignments.filter((a) => a.status === 'Active');
  const totalViews = assignments.reduce((s, a) => s + a.totalVerifiedViews, 0);
  const totalClicks = assignments.reduce((s, a) => s + a.totalTrackedClicks, 0);
  const totalEarned = assignments.reduce((s, a) => s + a.currentPayoutAmount, 0);
  const paidOut = payouts.filter((p) => ['Completed', 'Approved', 'Processing'].includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const pending = Math.max(0, totalEarned - paidOut);
  const name = profile?.displayName || 'there';

  // chart data: real per-campaign values for the selected metric (ascending)
  const chartCampaigns = [...assignments].sort((a, b) => metricVal(a, metric) - metricVal(b, metric)).slice(-8);
  const values = chartCampaigns.map((a) => metricVal(a, metric));
  const W = 640, H = 230;
  const { line, area, max } = chartPaths(values, W, H);
  const totalMetric = assignments.reduce((s, a) => s + metricVal(a, metric), 0);
  const avgMetric = assignments.length ? totalMetric / assignments.length : 0;
  const topCampaign = chartCampaigns[chartCampaigns.length - 1];

  // rating donut from real reviews
  const avgStars = reviews?.averageStars ?? 0;
  const reviewCount = reviews?.totalReviews ?? 0;
  const ratingScore = Math.round((avgStars / 5) * 100);
  const C = 314.159, dash = (ratingScore / 100) * C;

  return (
    <>
      {/* HERO */}
      <div className="vy-hero">
        <div className="vy-hero-grain" />
        <div className="vy-hero-glow" />
        <svg className="vy-hero-star" viewBox="0 0 220 220" fill="none" aria-hidden="true">
          <defs>
            <radialGradient id="hsGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFF4EC" /><stop offset="30%" stopColor="#FFD8C7" stopOpacity=".9" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></radialGradient>
            <linearGradient id="hsCore" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="60%" stopColor="#FBEEF6" /><stop offset="100%" stopColor="#EDE1FF" /></linearGradient>
          </defs>
          <circle cx="110" cy="110" r="104" fill="url(#hsGlow)" />
          <path d="M110 20 C118 78 142 102 200 110 C142 118 118 142 110 200 C102 142 78 118 20 110 C78 102 102 78 110 20Z" fill="url(#hsCore)" />
          <path d="M110 58 C115 95 125 105 162 110 C125 115 115 125 110 162 C105 125 95 115 58 110 C95 105 105 95 110 58Z" fill="#fff" opacity=".96" />
        </svg>
        <div className="vy-hero-inner">
          <div className="vy-hero-eyebrow"><span className="vy-live" /> Creator Studio · Live</div>
          <h1 className="vy-hero-title">Welcome back, <em>{name}</em></h1>
          <p className="vy-hero-subt">Verified views, accrued payouts and what is live on your account right now.</p>
          <div className="vy-kpis">
            <div className="vy-kpi"><div className="v">{formatNumber(totalViews)}</div><div className="l">Verified views</div></div>
            <div className="vy-kpi-sep" />
            <div className="vy-kpi"><div className="v money">{formatCurrency(totalEarned)}</div><div className="l">Total accrued</div></div>
            <div className="vy-kpi-sep" />
            <div className="vy-kpi"><div className="v">{formatCurrency(pending)}</div><div className="l">Pending payout</div></div>
            <div className="vy-kpi-sep" />
            <div className="vy-kpi"><div className="v">{active.length}</div><div className="l">Active campaigns</div></div>
          </div>
        </div>
      </div>

      {/* STAT ROW */}
      <div className="vy-statrow">
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><Svg d={I.camp} /></div><div className="vy-stat-lbl">Active campaigns</div><div className="vy-stat-val">{active.length}</div><div className="vy-stat-sub">{assignments.length} total assignments</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><Svg d={I.views} /></div><div className="vy-stat-lbl">Verified views</div><div className="vy-stat-val">{formatNumber(totalViews)}</div><div className="vy-stat-sub">{formatNumber(totalClicks)} tracked clicks</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><Svg d={I.earn} /></div><div className="vy-stat-lbl">Total earned</div><div className="vy-stat-val">{formatCurrency(totalEarned)}</div><div className="vy-stat-sub">accrued across campaigns</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><Svg d={I.clock} /></div><div className="vy-stat-lbl">Paid out</div><div className="vy-stat-val">{formatCurrency(paidOut)}</div><div className="vy-stat-sub">{formatCurrency(pending)} pending</div></div>
      </div>

      {/* TOP ROW: performance + rating */}
      <div className="vy-vtop">
        <div className="vy-card">
          <div className="vy-perf-head"><h3>Performance by campaign</h3><span className="vy-chip">{assignments.length} campaigns</span></div>
          <div className="vy-metric-row">
            <button className={`vy-metric${metric === 'views' ? ' on' : ''}`} onClick={() => setMetric('views')}><span className="ml">Views</span><span className="mv">{formatNumber(totalViews)}</span></button>
            <button className={`vy-metric${metric === 'earnings' ? ' on' : ''}`} onClick={() => setMetric('earnings')}><span className="ml">Earnings</span><span className="mv">{formatCurrency(totalEarned)}</span></button>
            <button className={`vy-metric${metric === 'clicks' ? ' on' : ''}`} onClick={() => setMetric('clicks')}><span className="ml">Clicks</span><span className="mv">{formatNumber(totalClicks)}</span></button>
          </div>
          {values.length >= 2 ? (
            <>
              <div className="vy-chart">
                <div className="vy-chart-y">
                  <span>{metricFmt(max, metric)}</span><span>{metricFmt(max * 0.75, metric)}</span><span>{metricFmt(max * 0.5, metric)}</span><span>{metricFmt(max * 0.25, metric)}</span><span>0</span>
                </div>
                <div className="vy-chart-plot">
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="vy-chart-svg">
                    <defs>
                      <linearGradient id="vyPerfFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F1A88F" stopOpacity=".42" /><stop offset="60%" stopColor="#F1A88F" stopOpacity=".1" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></linearGradient>
                      <linearGradient id="vyPerfLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FFD0BC" /><stop offset="100%" stopColor="#E68A6E" /></linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75].map((f) => <line key={f} className="gl" x1="0" y1={H * f} x2={W} y2={H * f} />)}
                    <path d={area} fill="url(#vyPerfFill)" />
                    <path d={line} fill="none" stroke="url(#vyPerfLine)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="vy-chart-x">{chartCampaigns.map((a) => <span key={a.id}>{a.campaignName}</span>)}</div>
                </div>
              </div>
              <div className="vy-perf-foot">
                <div className="vy-vf"><div className="l">Top campaign</div><div className="v">{topCampaign?.campaignName ?? '—'}</div></div>
                <div className="vy-vf"><div className="l">Average</div><div className="v">{metricFmt(Math.round(avgMetric), metric)}</div></div>
                <div className="vy-vf"><div className="l">Total</div><div className="v">{metricFmt(totalMetric, metric)}</div></div>
                <Link to="/creator/assignments" className="vy-link" style={{ margin: 0 }}>All campaigns →</Link>
              </div>
            </>
          ) : (
            <div className="vy-empty"><div className="t">Not enough data yet</div><div className="s">Once you have a couple of campaigns running, your performance breakdown shows up here.</div><Link to="/creator/browse" className="vy-btn vy-btn-blush" style={{ marginTop: 16 }}>Discover campaigns</Link></div>
          )}
        </div>

        <div className="vy-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="vy-perf-head"><h3>Creator rating</h3></div>
          <div className="vy-rep-donut">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(183,188,200,.25)" strokeWidth="9" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#vyPerfLine)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} transform="rotate(-90 60 60)" />
            </svg>
            <div className="vy-rep-center">
              <div className="vy-rep-num">{reviewCount ? avgStars.toFixed(1) : '—'}</div>
              <div className="vy-rep-lbl" style={{ color: reviewCount ? '#2f9d5b' : 'var(--muted)' }}>{reviewCount ? `${reviewCount} review${reviewCount > 1 ? 's' : ''}` : 'No ratings yet'}</div>
            </div>
          </div>
          <div className="vy-rep-rows">
            {reviews?.reviews?.length ? reviews.reviews.slice(0, 4).map((r) => (
              <div key={r.id} className="vy-rep-row">
                <span className="vy-rep-ck"><Svg d={I.check} sw={2} /></span>
                {r.reviewerName}
                <b>{r.stars}/5</b>
              </div>
            )) : (
              <div className="vy-empty" style={{ padding: '18px 0' }}><div className="s">Brand ratings from completed campaigns will appear here.</div></div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM SPLIT: active + discover */}
      <div className="vy-csplit">
        <div className="vy-card">
          <div className="vy-perf-head"><h3>Active campaigns</h3><span className="vy-badge peach">{active.length} live</span></div>
          {active.length ? active.slice(0, 5).map((a) => (
            <div key={a.id} className="vy-camp" onClick={() => navigate(`/creator/assignments/${a.id}`)}>
              <span className="vy-camp-thumb" style={{ background: grad(a.campaignName) }}>{initial(a.campaignName)}</span>
              <div className="vy-camp-main"><div className="vy-camp-b">{a.campaignName}</div><div className="vy-camp-m">Assigned {formatDate(a.assignedAt)}</div>{statusBadge(a.status)}</div>
              <div className="vy-camp-end"><div className="vy-camp-k">Views</div><div className="vy-camp-v">{formatNumber(a.totalVerifiedViews)}</div></div>
              <div className="vy-camp-end"><div className="vy-camp-k">Earned</div><div className="vy-camp-v">{formatCurrency(a.currentPayoutAmount)}</div></div>
            </div>
          )) : (
            <div className="vy-empty"><div className="t">No active campaigns yet</div><div className="s">Browse open campaigns and apply to the ones that fit your voice.</div><Link to="/creator/browse" className="vy-btn vy-btn-blush" style={{ marginTop: 16 }}>Discover campaigns</Link></div>
          )}
          {active.length > 0 && <Link to="/creator/assignments" className="vy-link" style={{ marginTop: 'auto', justifyContent: 'center' }}>View all campaigns →</Link>}
        </div>

        <div className="vy-card">
          <div className="vy-perf-head"><h3>Discover campaigns <span className="vy-ai">Open now</span></h3></div>
          <div className="vy-disc-sub">Open campaigns matching your market, ready to apply.</div>
          {browse.length ? browse.slice(0, 4).map((c) => {
            const filled = c.maxCreators ? Math.round(((c.maxCreators - c.spotsLeft) / c.maxCreators) * 100) : 0;
            return (
              <div key={c.id} className="vy-disc-item" onClick={() => navigate('/creator/browse')}>
                <span className="vy-disc-score" style={{ '--s': filled } as React.CSSProperties}>
                  <svg viewBox="0 0 44 44" className="vy-disc-ring"><circle className="vy-disc-track" cx="22" cy="22" r="19" /><circle className="vy-disc-prog" cx="22" cy="22" r="19" stroke="url(#vyPerfLine)" /></svg>
                  <span className="vy-disc-num">{c.spotsLeft}</span>
                </span>
                <div className="vy-disc-main"><div className="vy-disc-b">{c.name}</div><div className="vy-disc-m">{c.brandName} · {c.category} · {c.payoutSummary}</div><div className="vy-disc-why">{c.spotsLeft} of {c.maxCreators} spots left · min {formatNumber(c.minViews)} views</div></div>
              </div>
            );
          }) : (
            <div className="vy-empty"><div className="t">No open campaigns right now</div><div className="s">New campaigns in your market will appear here as they go live.</div></div>
          )}
          {browse.length > 0 && <Link to="/creator/browse" className="vy-link" style={{ marginTop: 'auto', justifyContent: 'center' }}>Explore all campaigns →</Link>}
        </div>
      </div>

      {/* recent activity */}
      {notifs.length > 0 && (
        <div className="vy-card" style={{ marginTop: 18 }}>
          <div className="vy-perf-head"><h3>Recent activity</h3></div>
          {notifs.slice(0, 5).map((n) => (
            <div key={n.id} className="vy-row">
              <span className="vy-mono" style={{ width: 38, height: 38, flex: '0 0 38px', fontSize: 15, background: n.isRead ? 'rgba(183,188,200,.3)' : 'linear-gradient(135deg,#FFD8C7,#F1A88F)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /></svg>
              </span>
              <div className="vy-row-main"><div className="vy-row-t">{n.title}</div><div className="vy-row-s" style={{ whiteSpace: 'normal' }}>{n.message}</div></div>
              <div className="vy-row-end"><div className="vy-row-k">{formatDate(n.createdAt)}</div></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
