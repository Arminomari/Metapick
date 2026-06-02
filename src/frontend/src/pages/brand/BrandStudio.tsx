import { Link, useNavigate } from 'react-router-dom';
import { useBrandCampaigns, useBrandProfile, usePrStats } from '@/hooks/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CampaignListItem } from '@/types';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function campTag(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return <span className="vcamp-tag prog">ACTIVE</span>;
  if (s === 'draft') return <span className="vcamp-tag up">DRAFT</span>;
  if (s.includes('review')) return <span className="vcamp-tag rev">IN REVIEW</span>;
  return <span className="vcamp-tag up">{status.toUpperCase()}</span>;
}

export function BrandStudioDashboard() {
  const navigate = useNavigate();
  const { data: campaignsRes, isLoading } = useBrandCampaigns();
  const { data: profile } = useBrandProfile();
  const { data: prStats } = usePrStats();

  if (isLoading) return <div style={{ padding: 80, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;

  const campaigns = campaignsRes?.data ?? [];
  const active = campaigns.filter((c) => c.status === 'Active');
  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.budgetSpent, 0);
  const totalCreators = campaigns.reduce((s, c) => s + c.approvedCreatorCount, 0);
  const spentPct = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const name = profile?.companyName || 'your brand';

  // chart: real spent per campaign, ascending
  const chartCamps: CampaignListItem[] = [...campaigns].sort((a, b) => a.budgetSpent - b.budgetSpent).slice(-8);
  const vals = chartCamps.map((c) => c.budgetSpent);
  const W = 900, H = 300, top = 14, bot = 14;
  const max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => {
    const x = vals.length === 1 ? W / 2 : (i / (vals.length - 1)) * W;
    const y = top + (1 - v / max) * (H - top - bot);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = pts.length ? `${line} L${W},${H} L0,${H} Z` : '';

  // PR acceptance donut
  const sent = prStats?.totalSent ?? 0;
  const accepted = prStats?.accepted ?? 0;
  const acceptRate = sent ? Math.round((accepted / sent) * 100) : 0;
  const C = 314.159, dash = (acceptRate / 100) * C;

  return (
    <section className="view active reveal" data-view="overview">
      <div className="hero">
        <div className="hero-grain" />
        <div className="hero-glow" />
        <svg className="hero-star" viewBox="0 0 220 220" fill="none" aria-hidden="true">
          <defs>
            <radialGradient id="bhsGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFF4EC" /><stop offset="30%" stopColor="#FFD8C7" stopOpacity=".9" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></radialGradient>
            <linearGradient id="bhsCore" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="60%" stopColor="#FBEEF6" /><stop offset="100%" stopColor="#EDE1FF" /></linearGradient>
          </defs>
          <circle cx="110" cy="110" r="104" fill="url(#bhsGlow)" />
          <path d="M110 20 C118 78 142 102 200 110 C142 118 118 142 110 200 C102 142 78 118 20 110 C78 102 102 78 110 20Z" fill="url(#bhsCore)" />
          <path d="M110 58 C115 95 125 105 162 110 C125 115 115 125 110 162 C105 125 95 115 58 110 C95 105 105 95 110 58Z" fill="#fff" opacity=".96" />
        </svg>
        <div className="hero-inner">
          <div className="hero-eyebrow"><span className="hero-live" /> Brand Desk · Live</div>
          <h1 className="hero-title">Welcome back, <em>{name}</em></h1>
          <p className="hero-sub">Active briefs, budget in motion and the creators delivering your reach, in real time.</p>
          <div className="hero-kpis">
            <div className="hero-kpi"><div className="hk-v">{active.length}</div><div className="hk-l">Active campaigns</div></div>
            <div className="hero-kpi-sep" />
            <div className="hero-kpi"><div className="hk-v hk-money"><span>{formatCurrency(totalBudget)}</span></div><div className="hk-l">Total budget</div></div>
            <div className="hero-kpi-sep" />
            <div className="hero-kpi"><div className="hk-v">{formatCurrency(totalSpent)}</div><div className="hk-l">Spent ({spentPct}%)</div></div>
            <div className="hero-kpi-sep" />
            <div className="hero-kpi"><div className="hk-v">{totalCreators}</div><div className="hk-l">Approved creators</div></div>
          </div>
        </div>
      </div>

      <div className="vtop">
        <div className="card vperf">
          <div className="vperf-head"><h3>Budget spent by campaign</h3><span className="vchip">{campaigns.length} campaigns</span></div>
          {vals.length >= 2 ? (
            <>
              <div className="vchart">
                <div className="vchart-y"><span>{formatCurrency(max)}</span><span>{formatCurrency(Math.round(max * .75))}</span><span>{formatCurrency(Math.round(max * .5))}</span><span>{formatCurrency(Math.round(max * .25))}</span><span>0</span></div>
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
                  <div className="vchart-x">{chartCamps.map((c) => <span key={c.id} style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>)}</div>
                </div>
              </div>
              <div className="vperf-foot">
                <div className="vf-stat"><div className="vf-l">Total budget</div><div className="vf-v">{formatCurrency(totalBudget)}</div></div>
                <div className="vf-stat"><div className="vf-l">Spent</div><div className="vf-v">{formatCurrency(totalSpent)}</div></div>
                <div className="vf-stat"><div className="vf-l">Utilisation</div><div className="vf-v">{spentPct}%</div></div>
                <Link className="vperf-link" to="/brand/campaigns" style={{ margin: 0 }}>All campaigns <Arrow /></Link>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px 10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>No campaign spend yet</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>Launch a campaign and your budget breakdown shows up here.</div>
              <Link to="/brand/campaigns/new" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 20px', marginTop: 16 }}>Create campaign</Link>
            </div>
          )}
        </div>

        <div className="card vrep">
          <div className="vperf-head"><h3>PR acceptance</h3></div>
          <div className="vrep-donut">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(183,188,200,.25)" strokeWidth="9" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#perfLine)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} transform="rotate(-90 60 60)" />
            </svg>
            <div className="vrep-center"><div className="vrep-num">{sent ? acceptRate + '%' : '—'}</div><div className="vrep-lbl" style={{ color: sent ? '#2f9d5b' : 'var(--muted)' }}>{sent ? 'accepted' : 'No offers yet'}</div></div>
          </div>
          <div className="vrep-rows">
            <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V10M12 20V4M19 20v-6" /></svg></span>Sent<b>{prStats?.totalSent ?? 0}</b></div>
            <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg></span>Accepted<b>{prStats?.accepted ?? 0}</b></div>
            <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></span>Viewed<b>{prStats?.viewed ?? 0}</b></div>
            <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>Pending<b>{prStats?.pending ?? 0}</b></div>
          </div>
          <Link className="vperf-link" to="/brand/pr">Open PR hub <Arrow /></Link>
        </div>
      </div>

      <div className="vcsplit">
        <div className="card vcamps">
          <div className="vperf-head"><h3>Recent campaigns</h3><Link to="/brand/campaigns/new" className="btn-apply" style={{ width: 'auto', padding: '9px 16px', fontSize: 12.5 }}>+ New campaign</Link></div>
          {campaigns.length ? campaigns.slice(0, 5).map((c) => {
            const pct = c.budget ? Math.round((c.budgetSpent / c.budget) * 100) : 0;
            return (
              <div key={c.id} className="vcamp" onClick={() => navigate(`/brand/campaigns/${c.id}`)}>
                <span className="vcamp-thumb" style={{ background: grad(c.name) }}><span className="brand-mono">{initial(c.name)}</span></span>
                <div className="vcamp-main">
                  <div className="vcamp-b">{c.name}</div>
                  <div className="vcamp-m">{c.category} · {formatDate(c.startDate)} – {formatDate(c.endDate)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{campTag(c.status)}<div className="progress-line" style={{ flex: 1, maxWidth: 150, marginTop: 0 }}><span style={{ width: `${pct}%` }} /></div><span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{pct}%</span></div>
                </div>
                <div className="vcamp-end"><div className="vcamp-k">Creators</div><div className="vcamp-v">{c.approvedCreatorCount}/{c.maxCreators}</div></div>
                <div className="vcamp-end"><div className="vcamp-k">Spent</div><div className="vcamp-v">{formatCurrency(c.budgetSpent)}</div></div>
              </div>
            );
          }) : (
            <div style={{ padding: '34px 10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>No campaigns yet</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>Launch your first campaign and start building your creator army.</div>
              <Link to="/brand/campaigns/new" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 20px', marginTop: 16 }}>Create campaign</Link>
            </div>
          )}
          {campaigns.length > 0 && <Link className="vperf-link center" to="/brand/campaigns">View all campaigns <Arrow /></Link>}
        </div>

        <div className="card vdisc">
          <div className="vperf-head"><h3>Grow your reach</h3></div>
          <div className="vdisc-sub">Find creators and send direct PR offers.</div>
          <div className="vdisc-item" onClick={() => navigate('/brand/creators')}>
            <span className="vcamp-thumb" style={{ background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></svg></span>
            <div className="vdisc-main"><div className="vdisc-b">Find creators</div><div className="vdisc-why">Search by audience, market and content style.</div></div>
          </div>
          <div className="vdisc-item" onClick={() => navigate('/brand/applications')}>
            <span className="vcamp-thumb" style={{ background: 'linear-gradient(135deg,#cdb8f2,#9c7de0)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></span>
            <div className="vdisc-main"><div className="vdisc-b">Review applications</div><div className="vdisc-why">Approve creators who applied to your briefs.</div></div>
          </div>
          <div className="vdisc-item" onClick={() => navigate('/brand/campaigns/new')}>
            <span className="vcamp-thumb" style={{ background: 'linear-gradient(135deg,#a9dcc0,#5fb98a)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M12 9v6M9 12h6" /></svg></span>
            <div className="vdisc-main"><div className="vdisc-b">Launch a campaign</div><div className="vdisc-why">Set a CPM, budget and brief in minutes.</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
