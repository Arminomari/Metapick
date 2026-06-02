import { ReactNode, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCreatorProfile, useBrandProfile, useNotifications, usePrUnreadCount } from '@/hooks/api';

/* ── icons ──────────────────────────────────────────── */
const I: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  discover: <><circle cx="12" cy="12" r="9" /><polygon points="16,8 13.5,13.5 8,16 10.5,10.5" /></>,
  campaigns: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></>,
  portfolio: <><circle cx="12" cy="9" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /><circle cx="12" cy="12" r="9" /></>,
  analytics: <><path d="M5 20V10M12 20V4M19 20v-6" /></>,
  pr: <><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" /></>,
  earnings: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14h2" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>,
  creators: <><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></>,
  applications: <><path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.4H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 .3 1.9" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
};
function Ico({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{I[name]}</svg>;
}

export interface NavItem { label: string; path: string; icon: string; badge?: number }

/* ── presentational shell ─────────────────────────────── */
function Shell({ nav, group, userName, userSub, initial, notifCount }:
  { nav: NavItem[]; group: string; userName: string; userSub: string; initial: string; notifCount: number }) {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (p: string) => loc.pathname === p || (p !== '/creator' && p !== '/brand' && loc.pathname.startsWith(p + '/'));
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="vy-app">
      <div className="vy-shell">
        <div className={`vy-backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
        <aside className={`vy-side${open ? ' open' : ''}`}>
          <Link to={nav[0].path} className="vy-brand" onClick={() => setOpen(false)} aria-label="VYRLE">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#0B0F17"><path d="M12 1.5c.7 5.6 2.9 7.8 8.5 8.5 .9.1 .9 1.4 0 1.5-5.6.7-7.8 2.9-8.5 8.5-.1.9-1.4.9-1.5 0-.7-5.6-2.9-7.8-8.5-8.5-.9-.1-.9-1.4 0-1.5 5.6-.7 7.8-2.9 8.5-8.5.1-.9 1.4-.9 1.5 0z" /></svg>
            VYRLE
          </Link>
          <div className="vy-navlabel">{group}</div>
          <nav className="vy-nav">
            {nav.map((n) => (
              <Link key={n.path} to={n.path} onClick={() => setOpen(false)} className={isActive(n.path) ? 'on' : ''}>
                <Ico name={n.icon} /> <span className="vy-nav-tx">{n.label}</span>
                {n.badge ? <span className="vy-nav-badge">{n.badge}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="vy-sep" />
          <nav className="vy-nav">
            <button className="vy-logout" onClick={handleLogout} style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 13, cursor: 'pointer', fontWeight: 500, fontSize: '13.5px', color: 'var(--muted)' }}>
              <span style={{ width: 18, height: 18, display: 'flex', color: 'var(--muted-2)' }}><Ico name="logout" /></span>
              <span className="vy-nav-tx">Log out</span>
            </button>
          </nav>
          <div className="vy-usercard">
            <div className="vy-uc-av">{initial}</div>
            <div className="vy-uc-name">{userName}</div>
            <div className="vy-uc-sub">{userSub}</div>
          </div>
        </aside>

        <div className="vy-main">
          <header className="vy-top">
            <div className="vy-menu-btn" onClick={() => setOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </div>
            <div className="vy-search">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input placeholder="Search…" />
            </div>
            <button className="vy-iconbtn" style={{ marginLeft: 'auto' }} aria-label="Notifications" onClick={() => navigate(nav[0].path)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>
              {notifCount > 0 && <span className="vy-ping">{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
          </header>
          <div className="vy-scroll"><Outlet /></div>
        </div>
      </div>
    </div>
  );
}

/* ── creator shell ────────────────────────────────────── */
export function CreatorShell() {
  const { email } = useAuthStore();
  const { data: profile } = useCreatorProfile();
  const { data: notifs } = useNotifications(true);
  const { data: prUnread } = usePrUnreadCount();

  const name = profile?.displayName || 'Creator';
  const nav: NavItem[] = [
    { label: 'Dashboard', path: '/creator', icon: 'dashboard' },
    { label: 'Discover', path: '/creator/browse', icon: 'discover' },
    { label: 'My Campaigns', path: '/creator/assignments', icon: 'campaigns' },
    { label: 'PR Hub', path: '/creator/pr', icon: 'pr', badge: prUnread || undefined },
    { label: 'Portfolio', path: '/creator/portfolio', icon: 'portfolio' },
    { label: 'Earnings', path: '/creator/earnings', icon: 'earnings' },
    { label: 'Profile', path: '/creator/profile', icon: 'profile' },
  ];
  return <Shell nav={nav} group="Creator" userName={name} userSub={profile?.tikTokUsername ? '@' + profile.tikTokUsername : email || ''} initial={(name[0] || 'C').toUpperCase()} notifCount={notifs?.totalCount ?? 0} />;
}

/* ── brand shell ──────────────────────────────────────── */
export function BrandShell() {
  const { email } = useAuthStore();
  const { data: profile } = useBrandProfile();
  const { data: notifs } = useNotifications(true);

  const name = profile?.companyName || 'Brand';
  const nav: NavItem[] = [
    { label: 'Dashboard', path: '/brand', icon: 'dashboard' },
    { label: 'Campaigns', path: '/brand/campaigns', icon: 'campaigns' },
    { label: 'Applications', path: '/brand/applications', icon: 'applications' },
    { label: 'Find Creators', path: '/brand/creators', icon: 'creators' },
    { label: 'PR Outreach', path: '/brand/pr', icon: 'pr' },
    { label: 'Settings', path: '/brand/settings', icon: 'settings' },
  ];
  return <Shell nav={nav} group="Brand" userName={name} userSub={email || ''} initial={(name[0] || 'B').toUpperCase()} notifCount={notifs?.totalCount ?? 0} />;
}
