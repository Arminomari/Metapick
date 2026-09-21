/**
 * The new shell (Phase 4): five-slot tab bar on mobile, sidebar on desktop,
 * a "+" sheet in the middle, and nothing hidden behind a hamburger.
 * Data hooks are the same ones the old shell used.
 */
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MotionProvider, PageTransition } from '@/components/motion';
import { Home, Briefcase, Users, Plus, MessageCircle, User, Video, Upload, Image, Droplets, Megaphone, Clapperboard, PenSquare } from 'lucide-react';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useActionCounts, useCreatorAssignments, useProfile, usePrUnreadCount, useUnreadChatCount } from '@/hooks/api';
import { useUgcActionCount, useUgcCollabs } from '@/hooks/ugc';
import { ToastProvider } from '@/components/vyrle/Toast';
import { Avatar, BottomSheet, ListRow, SheetMenu, TabBar, type TabItem } from '@/components/ds';

function activeTab(path: string, rules: [string, string][], fallback: string): string {
  for (const [prefix, key] of rules) if (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) return key;
  return fallback;
}

/* ── Email verification banner (same endpoint as before) ── */
const VERIFY_COOLDOWN_S = 60;
const verifyWait = () => { try { const at = Number(localStorage.getItem('vyrle-verify-sent-at') || 0); return Math.max(0, VERIFY_COOLDOWN_S - Math.floor((Date.now() - at) / 1000)); } catch { return 0; } };
function EmailVerifyBanner() {
  const { data: prof } = useProfile();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wait, setWait] = useState(verifyWait);
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('vyrle-verify-hidden') === '1'; } catch { return false; } });
  useEffect(() => { if (wait <= 0) return; const id = window.setInterval(() => setWait(verifyWait()), 1000); return () => window.clearInterval(id); }, [wait]);
  if (!prof || prof.emailVerified || hidden) return null;
  const resend = async () => {
    setBusy(true); setFailed(false);
    try { await api.post('/auth/resend-verification', { email: prof.email }); try { localStorage.setItem('vyrle-verify-sent-at', String(Date.now())); } catch { /* private mode */ } setWait(VERIFY_COOLDOWN_S); } catch { setFailed(true); }
    setBusy(false);
  };
  const hide = () => { try { sessionStorage.setItem('vyrle-verify-hidden', '1'); } catch { /* private mode */ } setHidden(true); };
  return (
    <div className="ds-banner" role="status">
      <span className="ds-grow">{t('Bekräfta din e-postadress')} · <strong>{prof.email}</strong>
        {wait > 0 ? <> · {t('Skickat')} ({wait} s)</> : <> · <button type="button" className="ds-banner-link" onClick={resend} disabled={busy}>{busy ? t('Skickar…') : t('Skicka länken igen')}</button></>}
        {failed && <> · {t('Kunde inte skicka just nu.')}</>}
      </span>
      <button type="button" className="ds-banner-link" onClick={hide} aria-label={t('Dölj')}>×</button>
    </div>
  );
}

/* ── Creator ─────────────────────────────────────────────── */
function CreatorAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: active } = useCreatorAssignments('Active', 1, 50);
  const { data: collabs = [] } = useUgcCollabs('creator');
  const deliverable = collabs.filter((c) => ['Accepted', 'InProgress', 'RevisionRequested'].includes(c.status));
  const go = (to: string) => { onClose(); navigate(to); };
  const rows = active?.data ?? [];
  return (
    <BottomSheet open={open} onClose={onClose} title={t('Lägg till')}>
      <SheetMenu>
        {rows.length === 0 && deliverable.length === 0 && (
          <ListRow leading={<Video />} title={t('Lägg till video')} subtitle={t('Du har inget aktivt uppdrag än — hitta en kampanj först')} onClick={() => go('/creator/browse')} />
        )}
        {rows.map((a) => (
          <ListRow key={a.id} leading={<Avatar name={a.campaignName} size="sm" rounded />} title={a.campaignName} subtitle={a.isTap ? t('Kran · lägg till video') : t('Kampanj · lägg till video')} onClick={() => go(`/creator/assignments/${a.id}?add=1`)} />
        ))}
        {deliverable.map((c) => (
          <ListRow key={c.id} leading={<Upload />} title={c.title} subtitle={`${t('Leverera videouppdrag')}${c.deadlineAt ? ` · ${t('senast')} ${formatDate(c.deadlineAt)}` : ''}`} onClick={() => go(`/creator/ugc/collabs/${c.id}#deliver`)} />
        ))}
        <ListRow leading={<Image />} title={t('Lägg till i portfolio')} onClick={() => go('/creator/profile?add=1')} />
      </SheetMenu>
    </BottomSheet>
  );
}

export function CreatorShell() {
  const loc = useLocation();
  const { data: counts } = useActionCounts('creator');
  const { data: chatUnread } = useUnreadChatCount();
  const { data: prUnread } = usePrUnreadCount();
  const { data: ugcCount } = useUgcActionCount('creator');
  const [add, setAdd] = useState(false);
  useEffect(() => { setAdd(false); }, [loc.pathname]);

  const needs = (counts?.awaitingYourVideo ?? 0) + (counts?.pendingCommunityInvites ?? 0) + (ugcCount ?? 0);
  const msgs = (counts?.unreadSupport ?? 0) + (chatUnread ?? 0) + (prUnread ?? 0);
  const current = activeTab(loc.pathname, [
    ['/creator/messages', 'msg'], ['/creator/notifications', 'home'],
    ['/creator/profile', 'me'], ['/creator/earnings', 'me'], ['/creator/analytics', 'me'], ['/creator/levels', 'me'], ['/creator/saved', 'me'], ['/creator/settings', 'me'], ['/creator/links', 'me'],
    ['/creator/assignments', 'work'], ['/creator/browse', 'work'], ['/creator/campaigns', 'work'], ['/creator/ugc', 'work'], ['/creator/brands', 'work'],
  ], 'home');
  const items: TabItem[] = [
    { key: 'home', label: t('Hem'), icon: <Home />, to: '/creator', dot: needs > 0 },
    { key: 'work', label: t('Kampanjer'), icon: <Briefcase />, to: '/creator/assignments' },
    { key: 'msg', label: t('Meddelanden'), icon: <MessageCircle />, to: '/creator/messages', badge: msgs },
    { key: 'me', label: t('Profil'), icon: <User />, to: '/creator/profile' },
  ];
  return (
    <div className="ds-root">
      <MotionProvider>
      <ToastProvider>
        <EmailVerifyBanner />
        <PageTransition><Outlet /></PageTransition>
        <TabBar items={items} current={current} action={{ label: t('Lägg till'), icon: <Plus />, onClick: () => setAdd(true) }} brand={<Link to="/creator" style={{ color: 'inherit' }}>VYRLE</Link>} />
        <CreatorAddSheet open={add} onClose={() => setAdd(false)} />
      </ToastProvider>
      </MotionProvider>
    </div>
  );
}

/* ── Brand ───────────────────────────────────────────────── */
function BrandCreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <BottomSheet open={open} onClose={onClose} title={t('Skapa')}>
      <SheetMenu>
        <ListRow leading={<Droplets />} title={t('Öppna en kran')} subtitle={t('Stående månadsbudget för din community')} onClick={() => go('/brand/tap/new')} />
        <ListRow leading={<Megaphone />} title={t('Skapa kampanj')} subtitle={t('Brief, budget och ersättning — creators ansöker')} onClick={() => go('/brand/campaigns/new')} />
        <ListRow leading={<Clapperboard />} title={t('Beställ video')} subtitle={t('UGC-video till fast pris')} onClick={() => go('/brand/ugc/campaigns/new')} />
        <ListRow leading={<PenSquare />} title={t('Skriv uppdatering')} subtitle={t('Till alla som följer er')} onClick={() => go('/brand/profile?post=1')} />
      </SheetMenu>
    </BottomSheet>
  );
}

export function BrandShell() {
  const loc = useLocation();
  const { data: counts } = useActionCounts('brand');
  const { data: chatUnread } = useUnreadChatCount();
  const { data: ugcCount } = useUgcActionCount('brand');
  const [create, setCreate] = useState(false);
  useEffect(() => { setCreate(false); }, [loc.pathname]);

  const needs = (counts?.pendingTapReviews ?? 0) + (counts?.pendingVideoReviews ?? 0) + (counts?.pendingApplications ?? 0) + (counts?.pendingCommunityRequests ?? 0) + (ugcCount ?? 0);
  const msgs = (counts?.unreadSupport ?? 0) + (chatUnread ?? 0);
  const current = activeTab(loc.pathname, [
    ['/brand/messages', 'msg'], ['/brand/notifications', 'home'],
    ['/brand/profile', 'me'], ['/brand/analytics', 'me'], ['/brand/settings', 'me'],
    ['/brand/creators', 'people'],
  ], 'home');
  const items: TabItem[] = [
    { key: 'home', label: t('Hem'), icon: <Home />, to: '/brand', dot: needs > 0 },
    { key: 'people', label: t('Creators'), icon: <Users />, to: '/brand/creators' },
    { key: 'msg', label: t('Meddelanden'), icon: <MessageCircle />, to: '/brand/messages', badge: msgs },
    { key: 'me', label: t('Profil'), icon: <User />, to: '/brand/profile' },
  ];
  return (
    <div className="ds-root">
      <MotionProvider>
      <ToastProvider>
        <EmailVerifyBanner />
        <PageTransition><Outlet /></PageTransition>
        <TabBar items={items} current={current} action={{ label: t('Skapa'), icon: <Plus />, onClick: () => setCreate(true) }} brand={<Link to="/brand" style={{ color: 'inherit' }}>VYRLE</Link>} />
        <BrandCreateSheet open={create} onClose={() => setCreate(false)} />
      </ToastProvider>
      </MotionProvider>
    </div>
  );
}

export { useAuthStore };
