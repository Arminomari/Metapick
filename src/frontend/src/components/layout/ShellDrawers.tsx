import { useNavigate } from 'react-router-dom';
import { t, lang } from '@/lib/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  useChatMessages, useSendMessage, useMarkChatRead, useChatConversations,
} from '@/hooks/api';
import type { ChatConversationDto, ChatMessageDto } from '@/types';

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('nyss');
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'sv-SE', { day: 'numeric', month: 'short' });
}

function useEsc(open: boolean, fn: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') fn(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, fn]);
}

const XIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/** Real image when the counterpart has one, branded gradient initial otherwise. */
function ChatAvatar({ name, imageUrl, size = 44, radius = 13 }: { name: string; imageUrl?: string | null; size?: number; radius?: number }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flex: `0 0 ${size}px`, boxShadow: '0 4px 12px rgba(180,120,90,.16)' }} />;
  }
  return (
    <span className="mc-avatar" style={{ background: grad(name), width: size, height: size, borderRadius: radius }}>
      <span className="brand-mono">{initial(name)}</span>
    </span>
  );
}

/* ───────────────────────── Notifications ───────────────────────── */
function notifStyle(type: string): { bg: string; color: string } {
  const t = (type || '').toLowerCase();
  if (t.includes('payout') || t.includes('payment') || t.includes('earn')) return { bg: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)', color: '#2f7d52' };
  if (t.includes('message') || t.includes('chat')) return { bg: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', color: '#9c4f31' };
  if (t.includes('application') || t.includes('approve') || t.includes('campaign')) return { bg: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', color: '#6a4ea8' };
  return { bg: 'linear-gradient(140deg,#FFE9D2,#F2C58A)', color: '#9c6b1c' };
}
function notifIcon(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('payout') || t.includes('payment') || t.includes('earn')) return <path d="M14.5 9.5c-.5-1-1.5-1.5-2.7-1.5-1.6 0-2.6.8-2.6 2 0 2.8 5.6 1.4 5.6 4.2 0 1.3-1.2 2.1-2.8 2.1-1.4 0-2.5-.6-3-1.6M12 6.5v11" />;
  if (t.includes('message') || t.includes('chat')) return <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />;
  if (t.includes('campaign') || t.includes('application')) return <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>;
  return <><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.5 20a2 2 0 0 0 3 0" /></>;
}

/** Where a notification takes you when tapped — by type, per role. */
function notifTarget(type: string, role: string | null): string | null {
  const brand = role === 'Brand';
  switch (type) {
    case 'NewApplication': return '/brand/applications';
    case 'ApplicationApproved':
    case 'ApplicationRejected': return '/creator/assignments';
    case 'SubmissionApproved':
    case 'SubmissionRejected':
    case 'VideoVerified': return brand ? '/brand/campaigns' : '/creator/assignments';
    case 'CampaignStarted':
    case 'CampaignCompleted': return brand ? '/brand/campaigns' : '/creator/assignments';
    case 'PayoutReady':
    case 'PayoutCompleted': return brand ? '/brand/campaigns' : '/creator/earnings';
    case 'PrOfferReceived': return '/creator/pr';
    case 'PrOfferAccepted':
    case 'PrOfferDeclined': return '/brand/pr';
    case 'BrandApproved': return '/brand';
    case 'CreatorApproved': return '/creator';
    case 'FraudAlert': return brand ? '/brand/campaigns' : null;
    default: return null;
  }
}

export function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useNotifications(false);
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  useEsc(open, onClose);
  const items = data?.data ?? [];
  const unread = items.filter((n) => !n.isRead);

  return (
    <>
      <div className={`nd-backdrop${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`nd-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="nd-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="nd-head-l" style={{ minWidth: 0, flexWrap: 'wrap' }}><h3>{t('Notiser')}</h3>{unread.length > 0 && <span className="nd-count">{unread.length} {t('nya')}</span>}</div>
          <div className="nd-head-r" style={{ marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {unread.length > 0 && <button className="nd-readall" onClick={() => markAll.mutate()} disabled={markAll.isPending}>{t('Markera alla lästa')}</button>}
            <button className="nd-close" onClick={onClose} aria-label={t('Stäng')}><XIcon /></button>
          </div>
        </div>
        <div className="nd-scroll">
          {items.length ? items.map((n) => {
            const st = notifStyle(n.type);
            return (
              <div
                key={n.id}
                className={`nd-item${n.isRead ? '' : ' unread'}`}
                role="button"
                tabIndex={0}
                style={notifTarget(n.type, role) ? { cursor: 'pointer' } : undefined}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLElement).click(); }}
                onClick={() => {
                  if (!n.isRead) markRead.mutate(n.id);
                  const to = notifTarget(n.type, role);
                  if (to) { onClose(); navigate(to); }
                }}
              >
                <div className="nd-ico" style={{ background: st.bg, color: st.color }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{notifIcon(n.type)}</svg>
                </div>
                <div className="nd-body" style={{ flex: 1, minWidth: 0 }}>
                  <div className="nd-t" style={{ flexWrap: 'wrap', overflowWrap: 'anywhere' }}>{n.title}{!n.isRead && <span className="nd-unread" />}</div>
                  <div className="nd-s" style={{ overflowWrap: 'anywhere' }}>{n.message}</div>
                  <div className="nd-time" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {ago(n.createdAt)}
                    {notifTarget(n.type, role) && <span style={{ color: '#9c4f31', fontWeight: 700 }}>{t('Öppna')} ›</span>}
                  </div>
                </div>
              </div>
            );
          }) : <DrawerEmpty>{t('Inga notiser än. Vi hör av oss här när något händer.')}</DrawerEmpty>}
        </div>
      </aside>
    </>
  );
}

/* ───────────────────────── Messages ───────────────────────── */
export function MessagesDrawer({ open, onClose }: { open: boolean; onClose: () => void; role?: string }) {
  const [sel, setSel] = useState<ChatConversationDto | null>(null);
  useEsc(open, () => { if (sel) setSel(null); else onClose(); });
  useEffect(() => { if (!open) setSel(null); }, [open]);

  return (
    <>
      <div className={`mc-backdrop${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`msg-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="nd-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="nd-head-l" style={{ minWidth: 0 }}><h3>{t('Meddelanden')}</h3></div>
          <div className="nd-head-r" style={{ marginLeft: 'auto' }}><button className="nd-close" onClick={onClose} aria-label={t('Stäng')}><XIcon /></button></div>
        </div>
        {open && <ConversationList onOpen={setSel} />}
        <ChatThread sel={sel} onBack={() => setSel(null)} onCloseAll={() => { setSel(null); onClose(); }} />
      </aside>
    </>
  );
}

function ConversationList({ onOpen }: { onOpen: (c: ChatConversationDto) => void }) {
  const { data: convos = [], isLoading } = useChatConversations();
  if (isLoading) return <DrawerLoading />;
  if (!convos.length) return <DrawerEmpty>{t('Inga konversationer än. När ett samarbete startar kan ni chatta här.')}</DrawerEmpty>;
  return (
    <div className="nd-scroll">
      <div className="mc-group"><span className="mc-group-dot active" />{t('Konversationer')} <span className="mc-group-n">{convos.length}</span></div>
      {convos.map((c) => (
        <div key={c.assignmentId} className="mc-item" onClick={() => onOpen(c)} style={{ minWidth: 0 }}>
          <ChatAvatar name={c.counterpartName} imageUrl={c.counterpartImageUrl} />
          <div className="mc-body" style={{ flex: 1, minWidth: 0 }}>
            <div className="mc-row1" style={{ minWidth: 0 }}>
              <span className="mc-name" style={{ minWidth: 0 }}>{c.counterpartName}</span>
              {c.lastMessageAt && <span className="mc-time">{ago(c.lastMessageAt)}</span>}
            </div>
            <div className="mc-prev"><span style={{ color: '#9c4f31', fontWeight: 600 }}>{c.campaignName}</span>{c.lastMessage ? ` · ${c.lastMessage}` : ''}</div>
          </div>
          {c.unreadCount > 0 && <span className="mc-unread">{c.unreadCount > 9 ? '9+' : c.unreadCount}</span>}
        </div>
      ))}
    </div>
  );
}

function ChatThread({ sel, onBack, onCloseAll }: { sel: ChatConversationDto | null; onBack: () => void; onCloseAll?: () => void }) {
  const { userId } = useAuthStore();
  const navigate = useNavigate();
  const openCounterpart = () => {
    if (!sel) return;
    onCloseAll?.();
    if (sel.counterpartRole === 'Creator' && sel.counterpartProfileId) navigate(`/brand/creators/${sel.counterpartProfileId}`);
    else if (sel.counterpartRole === 'Brand' && sel.counterpartProfileId) navigate(`/creator/brands/${sel.counterpartProfileId}`);
    else navigate(`/creator/assignments/${sel.assignmentId}`);
  };
  const { data: messages = [], isLoading } = useChatMessages(sel?.assignmentId ?? '');
  const send = useSendMessage();
  const markRead = useMarkChatRead();
  const [body, setBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (sel?.assignmentId) markRead.mutate(sel.assignmentId); /* eslint-disable-next-line */ }, [sel?.assignmentId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sel?.assignmentId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = body.trim();
    if (!t || !sel) return;
    setBody('');
    try { await send.mutateAsync({ assignmentId: sel.assignmentId, body: t }); } catch { setBody(t); }
  };

  return (
    <div className={`mc-thread${sel ? ' open' : ''}`}>
      {sel && (
        <>
          <div className="mc-thread-head" style={{ minWidth: 0 }}>
            <button className="mc-back" onClick={onBack} aria-label={t('Tillbaka')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <div onClick={openCounterpart} role="button" tabIndex={0} title={t('Visa profil')}
              onKeyDown={(e) => { if (e.key === 'Enter') openCounterpart(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 0 }}>
              <ChatAvatar name={sel.counterpartName} imageUrl={sel.counterpartImageUrl} size={42} radius={12} />
              <div className="mc-thread-meta" style={{ flex: 1, minWidth: 0 }}><div className="mc-thread-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.counterpartName} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>›</span></div><div className="mc-thread-status" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.campaignName}</div></div>
            </div>
          </div>
          <div className="mc-thread-scroll" ref={scrollRef}>
            <div style={{ marginTop: 'auto' }} aria-hidden />
            {isLoading ? <div className="mc-day">{t('Laddar…')}</div>
              : messages.length === 0 ? <div className="mc-day">{t('Starta konversationen')}</div>
              : messages.map((m: ChatMessageDto) => {
                const me = m.senderId === userId;
                return (
                  <div key={m.id} className={`mc-bub ${me ? 'me' : 'them'}`} style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                    {m.body}
                    <div className="mc-bt">{new Date(m.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}{me && (m.isRead ? ' ✓✓' : ' ✓')}</div>
                  </div>
                );
              })}
          </div>
          <form className="mc-composer" onSubmit={handleSend}>
            <div className="mc-input-wrap">
              <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Skriv ett meddelande…')} autoComplete="off" aria-label={t('Meddelande')} style={{ minWidth: 0, flex: 1, width: '100%' }} />
              <button className={`mc-send${body.trim() ? ' has-text' : ''}`} type="submit" disabled={send.isPending || !body.trim()} aria-label={t('Skicka')}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function DrawerEmpty({ children }: { children: ReactNode }) {
  return <div style={{ padding: '48px clamp(16px, 6vw, 28px)', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{children}</div>;
}
function DrawerLoading() {
  return <div style={{ padding: '48px clamp(16px, 6vw, 28px)', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>{t('Laddar…')}</div>;
}
