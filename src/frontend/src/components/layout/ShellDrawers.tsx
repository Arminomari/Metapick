import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  useNotifications, useMarkNotificationRead,
  useChatMessages, useSendMessage, useMarkChatRead,
  useCreatorAssignments, useBrandAnalytics,
} from '@/hooks/api';
import type { ChatMessageDto } from '@/types';

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'nyss';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
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

export function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useNotifications(false);
  const markRead = useMarkNotificationRead();
  useEsc(open, onClose);
  const items = data?.data ?? [];
  const unread = items.filter((n) => !n.isRead);

  return (
    <>
      <div className={`nd-backdrop${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`nd-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="nd-head">
          <div className="nd-head-l"><h3>Notiser</h3>{unread.length > 0 && <span className="nd-count">{unread.length} nya</span>}</div>
          <div className="nd-head-r">
            {unread.length > 0 && <button className="nd-readall" onClick={() => unread.forEach((n) => markRead.mutate(n.id))}>Markera alla lästa</button>}
            <button className="nd-close" onClick={onClose} aria-label="Stäng"><XIcon /></button>
          </div>
        </div>
        <div className="nd-scroll">
          {items.length ? items.map((n) => {
            const st = notifStyle(n.type);
            return (
              <div key={n.id} className={`nd-item${n.isRead ? '' : ' unread'}`} onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}>
                <div className="nd-ico" style={{ background: st.bg, color: st.color }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{notifIcon(n.type)}</svg>
                </div>
                <div className="nd-body">
                  <div className="nd-t">{n.title}{!n.isRead && <span className="nd-unread" />}</div>
                  <div className="nd-s">{n.message}</div>
                  <div className="nd-time">{ago(n.createdAt)}</div>
                </div>
              </div>
            );
          }) : <DrawerEmpty>Inga notiser än. Vi hör av oss här när något händer.</DrawerEmpty>}
        </div>
      </aside>
    </>
  );
}

/* ───────────────────────── Messages ───────────────────────── */
type Thread = { id: string; name: string; sub: string };

export function MessagesDrawer({ open, onClose, role }: { open: boolean; onClose: () => void; role?: string }) {
  const [sel, setSel] = useState<Thread | null>(null);
  useEsc(open, () => { if (sel) setSel(null); else onClose(); });
  useEffect(() => { if (!open) setSel(null); }, [open]);

  return (
    <>
      <div className={`mc-backdrop${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`msg-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="nd-head">
          <div className="nd-head-l"><h3>Meddelanden</h3></div>
          <div className="nd-head-r"><button className="nd-close" onClick={onClose} aria-label="Stäng"><XIcon /></button></div>
        </div>
        {open && (role === 'Brand' ? <BrandThreadList onOpen={setSel} /> : <CreatorThreadList onOpen={setSel} />)}
        <ChatThread sel={sel} onBack={() => setSel(null)} />
      </aside>
    </>
  );
}

function CreatorThreadList({ onOpen }: { onOpen: (t: Thread) => void }) {
  const { data, isLoading } = useCreatorAssignments(undefined, 1);
  const items = data?.data ?? [];
  if (isLoading) return <DrawerLoading />;
  if (!items.length) return <DrawerEmpty>Inga konversationer än. När du blir godkänd till en kampanj kan du chatta med varumärket här.</DrawerEmpty>;
  return (
    <div className="nd-scroll">
      <div className="mc-group"><span className="mc-group-dot active" />Dina samarbeten <span className="mc-group-n">{items.length}</span></div>
      {items.map((a) => (
        <ThreadRow key={a.id} name={a.campaignName} sub={a.status} onClick={() => onOpen({ id: a.id, name: a.campaignName, sub: a.status })} />
      ))}
    </div>
  );
}

function BrandThreadList({ onOpen }: { onOpen: (t: Thread) => void }) {
  const { campaigns, analytics, isLoading } = useBrandAnalytics();
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const threads: Thread[] = analytics.flatMap((a) => a.creatorPerformance.map((cp) => ({ id: cp.assignmentId, name: cp.displayName, sub: byId.get(a.campaignId)?.name ?? '' })));
  if (isLoading) return <DrawerLoading />;
  if (!threads.length) return <DrawerEmpty>Inga konversationer än. När du godkänner kreatörer till en kampanj kan du chatta med dem här.</DrawerEmpty>;
  return (
    <div className="nd-scroll">
      <div className="mc-group"><span className="mc-group-dot active" />Kreatörer <span className="mc-group-n">{threads.length}</span></div>
      {threads.map((t) => <ThreadRow key={t.id} name={t.name} sub={t.sub} onClick={() => onOpen(t)} />)}
    </div>
  );
}

function ThreadRow({ name, sub, onClick }: { name: string; sub: string; onClick: () => void }) {
  return (
    <div className="mc-item" onClick={onClick}>
      <span className="mc-avatar" style={{ background: grad(name) }}><span className="brand-mono">{initial(name)}</span></span>
      <div className="mc-body">
        <div className="mc-row1"><span className="mc-name">{name}</span></div>
        <div className="mc-prev">{sub || 'Öppna konversation'}</div>
      </div>
    </div>
  );
}

function ChatThread({ sel, onBack }: { sel: Thread | null; onBack: () => void }) {
  const { userId } = useAuthStore();
  const { data: messages = [], isLoading } = useChatMessages(sel?.id ?? '');
  const send = useSendMessage();
  const markRead = useMarkChatRead();
  const [body, setBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (sel?.id) markRead.mutate(sel.id); /* eslint-disable-next-line */ }, [sel?.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sel?.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = body.trim();
    if (!t || !sel) return;
    setBody('');
    try { await send.mutateAsync({ assignmentId: sel.id, body: t }); } catch { setBody(t); }
  };

  return (
    <div className={`mc-thread${sel ? ' open' : ''}`}>
      {sel && (
        <>
          <div className="mc-thread-head">
            <button className="mc-back" onClick={onBack} aria-label="Tillbaka"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
            <span className="mc-thread-av" style={{ background: grad(sel.name) }}><span className="brand-mono">{initial(sel.name)}</span></span>
            <div className="mc-thread-meta"><div className="mc-thread-name">{sel.name}</div><div className="mc-thread-status">{sel.sub}</div></div>
          </div>
          <div className="mc-thread-scroll" ref={scrollRef}>
            {isLoading ? <div className="mc-day">Laddar…</div>
              : messages.length === 0 ? <div className="mc-day">Starta konversationen</div>
              : messages.map((m: ChatMessageDto) => {
                const me = m.senderId === userId;
                return (
                  <div key={m.id} className={`mc-bub ${me ? 'me' : 'them'}`}>
                    {!me && <div style={{ fontSize: 10.5, fontWeight: 600, opacity: .65, marginBottom: 3 }}>{m.senderName}</div>}
                    {m.body}
                    <div className="mc-bt">{new Date(m.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}{me && (m.isRead ? ' ✓✓' : ' ✓')}</div>
                  </div>
                );
              })}
          </div>
          <form className="mc-composer" onSubmit={handleSend}>
            <div className="mc-input-wrap">
              <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Skriv ett meddelande…" autoComplete="off" aria-label="Meddelande" />
              <button className={`mc-send${body.trim() ? ' has-text' : ''}`} type="submit" disabled={send.isPending || !body.trim()} aria-label="Skicka">
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
  return <div style={{ padding: '48px 28px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55 }}>{children}</div>;
}
function DrawerLoading() {
  return <div style={{ padding: '48px 28px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>Laddar…</div>;
}
