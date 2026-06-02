import { Link, useNavigate } from 'react-router-dom';
import {
  useCreatorAssignments, useCreatorPayouts, useCreatorProfile,
  useMyApplications, useNotifications,
} from '@/hooks/api';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
  'linear-gradient(135deg,#e8c6d1,#b88aa0)',
];
const grad = (s: string) => GRADS[(s ? s.charCodeAt(0) : 0) % GRADS.length];

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'active') return <span className="vy-badge peach">ACTIVE</span>;
  if (s.includes('review') || s.includes('pending')) return <span className="vy-badge lilac">{status.toUpperCase()}</span>;
  if (s === 'completed' || s === 'paid') return <span className="vy-badge green">{status.toUpperCase()}</span>;
  if (s.includes('reject')) return <span className="vy-badge red">{status.toUpperCase()}</span>;
  return <span className="vy-badge grey">{status.toUpperCase()}</span>;
}

const ico = {
  views: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  earn: <><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  camp: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

export function CreatorStudioDashboard() {
  const navigate = useNavigate();
  const { data: assignmentsRes, isLoading } = useCreatorAssignments();
  const { data: payoutsRes } = useCreatorPayouts();
  const { data: profile } = useCreatorProfile();
  const { data: appsRes } = useMyApplications();
  const { data: notifRes } = useNotifications();

  if (isLoading) return <div className="vy-spinner" />;

  const assignments = assignmentsRes?.data ?? [];
  const payouts = payoutsRes?.data ?? [];
  const apps = appsRes?.data ?? [];
  const notifs = notifRes?.data ?? [];

  const active = assignments.filter((a) => a.status === 'Active');
  const totalViews = assignments.reduce((s, a) => s + a.totalVerifiedViews, 0);
  const totalClicks = assignments.reduce((s, a) => s + a.totalTrackedClicks, 0);
  const totalEarned = assignments.reduce((s, a) => s + a.currentPayoutAmount, 0);
  const paidOut = payouts
    .filter((p) => ['Completed', 'Approved', 'Processing'].includes(p.status))
    .reduce((s, p) => s + p.amount, 0);
  const pending = Math.max(0, totalEarned - paidOut);
  const name = profile?.displayName || 'there';

  return (
    <>
      {/* hero */}
      <div className="vy-hero">
        <div className="vy-hero-eyebrow"><span className="vy-live" /> Creator Studio · Live</div>
        <h1 className="vy-hero-title">Welcome back, <em>{name}</em></h1>
        <p className="vy-hero-subt">Verified views, accrued payouts and what is actually live on your account right now.</p>
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

      {/* stat row */}
      <div className="vy-statrow">
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ico.camp}</svg></div><div className="vy-stat-lbl">Active campaigns</div><div className="vy-stat-val">{active.length}</div><div className="vy-stat-sub">{assignments.length} total assignments</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ico.views}</svg></div><div className="vy-stat-lbl">Verified views</div><div className="vy-stat-val">{formatNumber(totalViews)}</div><div className="vy-stat-sub">{formatNumber(totalClicks)} tracked clicks</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ico.earn}</svg></div><div className="vy-stat-lbl">Total earned</div><div className="vy-stat-val">{formatCurrency(totalEarned)}</div><div className="vy-stat-sub">accrued across campaigns</div></div>
        <div className="vy-card vy-stat"><div className="vy-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ico.clock}</svg></div><div className="vy-stat-lbl">Paid out</div><div className="vy-stat-val">{formatCurrency(paidOut)}</div><div className="vy-stat-sub">{formatCurrency(pending)} pending</div></div>
      </div>

      {/* split: active campaigns + activity */}
      <div className="vy-split">
        <div className="vy-card">
          <div className="vy-sechead"><h3>Active campaigns</h3><span className="vy-badge peach">{active.length} live</span></div>
          {active.length ? active.map((a) => (
            <div key={a.id} className="vy-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/creator/assignments/${a.id}`)}>
              <span className="vy-mono" style={{ background: grad(a.campaignName) }}>{(a.campaignName[0] || 'C').toUpperCase()}</span>
              <div className="vy-row-main">
                <div className="vy-row-t">{a.campaignName}</div>
                <div className="vy-row-s">Assigned {formatDate(a.assignedAt)}</div>
                <div style={{ marginTop: 6 }}>{statusBadge(a.status)}</div>
              </div>
              <div className="vy-row-end"><div className="vy-row-k">Views</div><div className="vy-row-v">{formatNumber(a.totalVerifiedViews)}</div></div>
              <div className="vy-row-end"><div className="vy-row-k">Earned</div><div className="vy-row-v">{formatCurrency(a.currentPayoutAmount)}</div></div>
            </div>
          )) : (
            <div className="vy-empty"><div className="t">No active campaigns yet</div><div className="s">Browse open campaigns and apply to the ones that fit your voice.</div><Link to="/creator/browse" className="vy-btn vy-btn-blush" style={{ marginTop: 16 }}>Discover campaigns</Link></div>
          )}
          {active.length > 0 && <Link to="/creator/assignments" className="vy-link" style={{ marginTop: 16 }}>View all campaigns →</Link>}
        </div>

        <div className="vy-card">
          <div className="vy-sechead"><h3>Recent activity</h3></div>
          {notifs.length ? notifs.slice(0, 6).map((n) => (
            <div key={n.id} className="vy-row">
              <span className="vy-mono" style={{ width: 38, height: 38, flex: '0 0 38px', fontSize: 15, background: n.isRead ? 'rgba(183,188,200,.3)' : 'linear-gradient(135deg,#FFD8C7,#F1A88F)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /></svg>
              </span>
              <div className="vy-row-main"><div className="vy-row-t">{n.title}</div><div className="vy-row-s" style={{ whiteSpace: 'normal' }}>{n.message}</div></div>
              <div className="vy-row-end"><div className="vy-row-k">{formatDate(n.createdAt)}</div></div>
            </div>
          )) : (
            <div className="vy-empty"><div className="t">Nothing here yet</div><div className="s">Updates about campaigns, views and payouts will show up here.</div></div>
          )}
        </div>
      </div>

      {/* applications status */}
      {apps.length > 0 && (
        <div className="vy-card" style={{ marginTop: 18 }}>
          <div className="vy-sechead"><h3>Your applications</h3><Link to="/creator/browse" className="vy-link">Find more →</Link></div>
          {apps.slice(0, 5).map((ap) => (
            <div key={ap.id} className="vy-row">
              <span className="vy-mono" style={{ background: grad(ap.campaignName) }}>{(ap.campaignName[0] || 'C').toUpperCase()}</span>
              <div className="vy-row-main"><div className="vy-row-t">{ap.campaignName}</div><div className="vy-row-s">Applied {formatDate(ap.createdAt)}</div></div>
              <div className="vy-row-end">{statusBadge(ap.status)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
