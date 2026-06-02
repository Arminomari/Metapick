import { Link, useNavigate } from 'react-router-dom';
import { useBrandCampaigns, useBrandProfile, usePrStats } from '@/hooks/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
];
const grad = (s: string) => GRADS[(s ? s.charCodeAt(0) : 0) % GRADS.length];

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'active') return <span className="vy-badge peach">ACTIVE</span>;
  if (s === 'draft') return <span className="vy-badge grey">DRAFT</span>;
  if (s.includes('review') || s.includes('pending')) return <span className="vy-badge lilac">{status.toUpperCase()}</span>;
  if (s === 'completed' || s === 'ended') return <span className="vy-badge green">{status.toUpperCase()}</span>;
  return <span className="vy-badge grey">{status.toUpperCase()}</span>;
}

const ico = {
  camp: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  budget: <><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  spend: <><path d="M3 17 9 11l4 4 8-8" /><path d="M15 7h6v6" /></>,
  creators: <><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></>,
};

export function BrandStudioDashboard() {
  const navigate = useNavigate();
  const { data: campaignsRes, isLoading } = useBrandCampaigns();
  const { data: profile } = useBrandProfile();
  const { data: prStats } = usePrStats();

  if (isLoading) return <div className="vy-spinner" />;

  const campaigns = campaignsRes?.data ?? [];
  const active = campaigns.filter((c) => c.status === 'Active');
  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.budgetSpent, 0);
  const totalCreators = campaigns.reduce((s, c) => s + c.approvedCreatorCount, 0);
  const spentPct = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const name = profile?.companyName || 'your brand';

  return (
    <>
      <div className="vy-hero">
        <div className="vy-hero-grain" />
        <div className="vy-hero-glow" />
        <svg className="vy-hero-star" viewBox="0 0 220 220" fill="none" aria-hidden="true">
          <defs>
            <radialGradient id="bhsGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFF4EC" /><stop offset="30%" stopColor="#FFD8C7" stopOpacity=".9" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></radialGradient>
            <linearGradient id="bhsCore" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="60%" stopColor="#FBEEF6" /><stop offset="100%" stopColor="#EDE1FF" /></linearGradient>
          </defs>
          <circle cx="110" cy="110" r="104" fill="url(#bhsGlow)" />
          <path d="M110 20 C118 78 142 102 200 110 C142 118 118 142 110 200 C102 142 78 118 20 110 C78 102 102 78 110 20Z" fill="url(#bhsCore)" />
          <path d="M110 58 C115 95 125 105 162 110 C125 115 115 125 110 162 C105 125 95 115 58 110 C95 105 105 95 110 58Z" fill="#fff" opacity=".96" />
        </svg>
        <div className="vy-hero-inner">
          <div className="vy-hero-eyebrow"><span className="vy-live" /> Brand Desk · Live</div>
          <h1 className="vy-hero-title">Welcome back, <em>{name}</em></h1>
          <p className="vy-hero-subt">Active briefs, budget in motion and the creators delivering your reach, in real time.</p>
          <div className="vy-kpis">
            <div className="vy-kpi"><div className="v">{active.length}</div><div className="l">Active campaigns</div></div>
            <div className="vy-kpi-sep" />
            <div className="vy-kpi"><div className="v money">{formatCurrency(totalBudget)}</div><div className="l">Total budget</div></div>
            <div className="vy-kpi-sep" />
            <div className="vy-kpi"><div className="v">{formatCurrency(totalSpent)}</div><div className="l">Spent ({spentPct}%)</div></div>
            <div className="vy-kpi-sep" />
            <div className="vy-kpi"><div className="v">{totalCreators}</div><div className="l">Approved creators</div></div>
          </div>
        </div>
      </div>

      <div className="vy-statrow">
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ico.camp}</svg></div><div className="vy-stat-lbl">Active campaigns</div><div className="vy-stat-val">{active.length}</div><div className="vy-stat-sub">{campaigns.length} total</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ico.creators}</svg></div><div className="vy-stat-lbl">Approved creators</div><div className="vy-stat-val">{totalCreators}</div><div className="vy-stat-sub">across all campaigns</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ico.budget}</svg></div><div className="vy-stat-lbl">Total budget</div><div className="vy-stat-val">{formatCurrency(totalBudget)}</div><div className="vy-stat-sub">committed</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ico.spend}</svg></div><div className="vy-stat-lbl">Spent</div><div className="vy-stat-val">{formatCurrency(totalSpent)}</div><div className="vy-stat-sub">{spentPct}% of budget</div></div>
      </div>

      <div className="vy-csplit">
        <div className="vy-card">
          <div className="vy-perf-head"><h3>Recent campaigns</h3><Link to="/brand/campaigns/new" className="vy-btn vy-btn-primary" style={{ padding: '9px 16px', fontSize: 12.5 }}>+ New campaign</Link></div>
          {campaigns.length ? campaigns.slice(0, 6).map((c) => {
            const pct = c.budget ? Math.round((c.budgetSpent / c.budget) * 100) : 0;
            return (
              <div key={c.id} className="vy-camp" onClick={() => navigate(`/brand/campaigns/${c.id}`)}>
                <span className="vy-camp-thumb" style={{ background: grad(c.name) }}>{(c.name[0] || 'C').toUpperCase()}</span>
                <div className="vy-camp-main">
                  <div className="vy-camp-b">{c.name}</div>
                  <div className="vy-camp-m">{c.category} · {formatDate(c.startDate)} – {formatDate(c.endDate)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {statusBadge(c.status)}
                    <div className="vy-prog" style={{ flex: 1, maxWidth: 140 }}><span style={{ width: `${pct}%` }} /></div>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{pct}%</span>
                  </div>
                </div>
                <div className="vy-camp-end"><div className="vy-camp-k">Creators</div><div className="vy-camp-v">{c.approvedCreatorCount}/{c.maxCreators}</div></div>
                <div className="vy-camp-end"><div className="vy-camp-k">Spent</div><div className="vy-camp-v">{formatCurrency(c.budgetSpent)}</div></div>
              </div>
            );
          }) : (
            <div className="vy-empty"><div className="t">No campaigns yet</div><div className="s">Launch your first campaign and start building your creator army.</div><Link to="/brand/campaigns/new" className="vy-btn vy-btn-blush" style={{ marginTop: 16 }}>Create campaign</Link></div>
          )}
          {campaigns.length > 0 && <Link to="/brand/campaigns" className="vy-link" style={{ marginTop: 16 }}>View all campaigns →</Link>}
        </div>

        <div className="vy-card">
          <div className="vy-sechead"><h3>PR outreach</h3><Link to="/brand/pr" className="vy-link">Open hub →</Link></div>
          {prStats ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 14 }}>
                <div style={{ padding: 16, borderRadius: 14, background: 'linear-gradient(140deg,rgba(255,227,211,.5),rgba(237,225,255,.4))', border: '1px solid rgba(241,168,143,.18)' }}><div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.03em' }}>{prStats.totalSent}</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Offers sent</div></div>
                <div style={{ padding: 16, borderRadius: 14, background: 'linear-gradient(140deg,rgba(255,227,211,.5),rgba(237,225,255,.4))', border: '1px solid rgba(241,168,143,.18)' }}><div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.03em', color: 'var(--peach-deep)' }}>{prStats.accepted}</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Accepted</div></div>
              </div>
              <div className="vy-minibar"><span className="nm">Pending</span><div className="tr"><span style={{ width: `${pctOf(prStats.pending, prStats.totalSent)}%` }} /></div><span className="pct">{prStats.pending}</span></div>
              <div className="vy-minibar"><span className="nm">Viewed</span><div className="tr"><span style={{ width: `${pctOf(prStats.viewed, prStats.totalSent)}%` }} /></div><span className="pct">{prStats.viewed}</span></div>
              <div className="vy-minibar"><span className="nm">Declined</span><div className="tr"><span style={{ width: `${pctOf(prStats.declined, prStats.totalSent)}%` }} /></div><span className="pct">{prStats.declined}</span></div>
            </>
          ) : (
            <div className="vy-empty"><div className="t">No PR offers sent</div><div className="s">Find creators and send direct PR offers from the hub.</div><Link to="/brand/creators" className="vy-btn vy-btn-blush" style={{ marginTop: 16 }}>Find creators</Link></div>
          )}
        </div>
      </div>
    </>
  );
}

function pctOf(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}
