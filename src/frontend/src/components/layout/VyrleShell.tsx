import { ReactNode, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCreatorProfile, useBrandProfile, useNotifications, usePrUnreadCount, useUnreadChatCount } from '@/hooks/api';
import { formatNumber } from '@/lib/utils';
import { NotificationsDrawer, MessagesDrawer } from './ShellDrawers';
import { ToastProvider } from '@/components/vyrle/Toast';

const S = (d: ReactNode, sw = 1.7) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const ICON: Record<string, ReactNode> = {
  dashboard: S(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  discover: S(<><circle cx="12" cy="12" r="9" /><polygon points="16,8 13.5,13.5 8,16 10.5,10.5" /></>),
  campaigns: S(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></>),
  portfolio: S(<><circle cx="12" cy="9" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /><circle cx="12" cy="12" r="9" /></>),
  analytics: S(<><path d="M5 20V10M12 20V4M19 20v-6" /></>),
  pr: S(<><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" /></>),
  links: S(<><path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" /></>),
  earnings: S(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14h2" /></>),
  levels: S(<><circle cx="12" cy="9" r="4" /><path d="M9 13l-1.5 8 4.5-2.5 4.5 2.5L15 13" /></>),
  saved: S(<><path d="M7 4h10v16l-5-3-5 3z" /></>),
  profile: S(<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>),
  applications: S(<><path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  creators: S(<><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></>),
  settings: S(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.4H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 .3 1.9" /></>),
  logout: S(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>),
};

interface NavItem { label: string; path: string; icon: string; badge?: number; tag?: string }

function ShellChrome({ group, role, nav, name, handle, sub, initial, bellBadge, chatBadge, children }:
  { group: string; role: string; nav: NavItem[]; name: string; handle: string; sub: ReactNode; initial: string; bellBadge: number; chatBadge: number; children?: ReactNode }) {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const loc = useLocation();
  const home = nav[0].path;
  const isActive = (p: string) => loc.pathname === p || (p !== home && loc.pathname.startsWith(p + '/'));
  const handleLogout = () => { logout(); navigate('/login'); };
  const [drawer, setDrawer] = useState<'none' | 'notif' | 'msg'>('none');

  return (
    <div className="vy-app">
      <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          <Link to={home} className="brand" aria-label="VYRLE" style={{ textDecoration: 'none' }}>
            <svg className="brand-star" width="26" height="26" viewBox="0 0 24 24" fill="#0B0F17" aria-hidden="true"><path d="M12 1.5c.7 5.6 2.9 7.8 8.5 8.5 .9.1 .9 1.4 0 1.5-5.6.7-7.8 2.9-8.5 8.5-.1.9-1.4.9-1.5 0-.7-5.6-2.9-7.8-8.5-8.5-.9-.1-.9-1.4 0-1.5 5.6-.7 7.8-2.9 8.5-8.5.1-.9 1.4-.9 1.5 0z" /></svg>
            VYRLE
          </Link>

          <div className="nav-label">{group}</div>
          <nav className="nav-group">
            {nav.map((n) => (
              <Link key={n.path} to={n.path} className={`nav-item${isActive(n.path) ? ' active' : ''}`} style={{ textDecoration: 'none' }}>
                {ICON[n.icon]} <span className="nav-tx">{n.label}</span>
                {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
                {n.tag ? <span className="nav-new">{n.tag}</span> : null}
              </Link>
            ))}
          </nav>

          <div className="nav-sep" />
          <nav className="nav-group">
            <button className="nav-item nav-logout" onClick={handleLogout}>
              {ICON.logout} <span className="nav-tx">Log out</span>
            </button>
          </nav>

          <div className="creator-card">
            <div className="cc-top">
              <div className="cc-avatar-wrap">
                <div className="cc-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Fraunces",serif', fontSize: 26, color: '#fff', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)' }}>{initial}</div>
                <span className="cc-online" />
              </div>
              <div className="cc-name">{name}</div>
              <div className="cc-handle">{handle}</div>
            </div>
            {sub}
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input placeholder="Search campaigns, brands, insights..." />
              <span className="kbd">⌘ K</span>
            </div>
            <div className="top-right">
              <button className="icon-btn" aria-label="Meddelanden" onClick={() => setDrawer((d) => d === 'msg' ? 'none' : 'msg')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                {chatBadge > 0 && <span className="ping ping-chat">{chatBadge > 9 ? '9+' : chatBadge}</span>}
              </button>
              <button className="icon-btn" aria-label="Notiser" onClick={() => setDrawer((d) => d === 'notif' ? 'none' : 'notif')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>
                {bellBadge > 0 && <span className="ping">{bellBadge > 9 ? '9+' : bellBadge}</span>}
              </button>
              <div className="profile-chip">
                <div className="avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Fraunces",serif', color: '#fff', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)' }}>{initial}</div>
                <div><div className="nm">{name}</div><div className="hd">{handle}</div></div>
              </div>
            </div>
          </header>
          <div className="scroll"><Outlet /></div>
        </div>
      </div>
      <NotificationsDrawer open={drawer === 'notif'} onClose={() => setDrawer('none')} />
      <MessagesDrawer open={drawer === 'msg'} onClose={() => setDrawer('none')} role={role} />
      {children}
      </ToastProvider>
    </div>
  );
}

export function CreatorShell() {
  const { email } = useAuthStore();
  const { data: profile } = useCreatorProfile();
  const { data: notifs } = useNotifications(true);
  const { data: prUnread } = usePrUnreadCount();
  const { data: chatUnread } = useUnreadChatCount();

  const name = profile?.displayName || 'Creator';
  const handle = profile?.tikTokUsername ? '@' + profile.tikTokUsername : (email || '');
  const nav: NavItem[] = [
    { label: 'Dashboard', path: '/creator', icon: 'dashboard' },
    { label: 'Discover', path: '/creator/browse', icon: 'discover' },
    { label: 'My Campaigns', path: '/creator/assignments', icon: 'campaigns' },
    { label: 'Portfolio', path: '/creator/portfolio', icon: 'portfolio' },
    { label: 'Analytics', path: '/creator/analytics', icon: 'analytics' },
    { label: 'PR Hub', path: '/creator/pr', icon: 'pr', badge: prUnread || undefined },
    { label: 'Link Tree', path: '/creator/links', icon: 'links' },
    { label: 'Earnings', path: '/creator/earnings', icon: 'earnings' },
    { label: 'Creator Levels', path: '/creator/levels', icon: 'levels', tag: 'NEW' },
    { label: 'Saved', path: '/creator/saved', icon: 'saved' },
    { label: 'Settings', path: '/creator/profile', icon: 'settings' },
  ];
  const sub = (
    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
      {formatNumber(profile?.followerCount ?? 0)} followers · {profile?.category || 'Creator'}
    </div>
  );
  return <ShellChrome group="Creator" role="Creator" nav={nav} name={name} handle={handle} sub={sub} initial={(name[0] || 'C').toUpperCase()} bellBadge={notifs?.totalCount ?? 0} chatBadge={chatUnread ?? 0} />;
}

export function BrandShell() {
  const { email } = useAuthStore();
  const { data: profile } = useBrandProfile();
  const { data: notifs } = useNotifications(true);
  const { data: chatUnread } = useUnreadChatCount();

  const name = profile?.companyName || 'Brand';
  const nav: NavItem[] = [
    { label: 'Dashboard', path: '/brand', icon: 'dashboard' },
    { label: 'Analytics', path: '/brand/analytics', icon: 'analytics' },
    { label: 'Campaigns', path: '/brand/campaigns', icon: 'campaigns' },
    { label: 'Applications', path: '/brand/applications', icon: 'applications' },
    { label: 'Find Creators', path: '/brand/creators', icon: 'creators' },
    { label: 'PR Outreach', path: '/brand/pr', icon: 'pr' },
    { label: 'Settings', path: '/brand/settings', icon: 'settings' },
  ];
  const sub = (
    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
      {profile?.industry || 'Brand'} · {profile?.status || ''}
    </div>
  );
  return <ShellChrome group="Brand" role="Brand" nav={nav} name={name} handle={email || ''} sub={sub} initial={(name[0] || 'B').toUpperCase()} bellBadge={notifs?.totalCount ?? 0} chatBadge={chatUnread ?? 0} />;
}
