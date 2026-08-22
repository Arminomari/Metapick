import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { useChatMessages, useSendMessage, useMarkChatRead, useChatConversations } from '@/hooks/api';
import { useAuthStore } from '@/stores/authStore';
import type { ChatMessageDto } from '@/types';

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

interface ChatPanelProps {
  assignmentId: string;
}

/**
 * Inline chat in the VYRLE design language. The counterpart identity (creator
 * name+avatar for brands, company name+logo for creators) comes from the
 * conversations endpoint so it always matches the messages drawer.
 */
export function ChatPanel({ assignmentId }: ChatPanelProps) {
  const { userId } = useAuthStore();
  const { data: messages = [], isLoading } = useChatMessages(assignmentId);
  const { data: convos = [] } = useChatConversations();
  const convo = convos.find((c) => c.assignmentId === assignmentId);
  const send = useSendMessage();
  const markRead = useMarkChatRead();
  const [body, setBody] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (assignmentId) markRead.mutate(assignmentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = body.trim();
    if (!t) return;
    setBody('');
    try { await send.mutateAsync({ assignmentId, body: t }); } catch { setBody(t); }
  };

  const name = convo?.counterpartName ?? t('Direktchatt');
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 460, overflow: 'hidden',
      background: 'rgba(255,255,255,.75)', border: '1px solid rgba(241,168,143,.2)',
      borderRadius: 20, boxShadow: '0 10px 30px rgba(180,120,90,.08)',
    }}>
      <div className="mc-thread-head" onClick={() => {
        if (!convo?.counterpartProfileId) return;
        if (convo.counterpartRole === 'Creator') navigate(`/brand/creators/${convo.counterpartProfileId}`);
        else if (convo.counterpartRole === 'Brand') navigate(`/creator/brands/${convo.counterpartProfileId}`);
      }}
        style={convo?.counterpartProfileId ? { cursor: 'pointer' } : undefined}
        title={convo?.counterpartProfileId ? t('Visa profil') : undefined}>
        {convo?.counterpartImageUrl
          ? <img src={convo.counterpartImageUrl} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: 'cover', flex: '0 0 42px', boxShadow: '0 4px 12px rgba(180,120,90,.16)' }} />
          : <span className="mc-thread-av" style={{ background: grad(name) }}><span className="brand-mono">{initial(name)}</span></span>}
        <div className="mc-thread-meta">
          <div className="mc-thread-name">{name}</div>
          {convo?.campaignName && <div className="mc-thread-status">{convo.campaignName}</div>}
        </div>
      </div>

      <div className="mc-thread-scroll" ref={scrollRef}>
        <div style={{ marginTop: 'auto' }} aria-hidden />
        {isLoading ? <div className="mc-day">{t('Laddar…')}</div>
          : messages.length === 0 ? <div className="mc-day">{t('Inga meddelanden än — starta konversationen!')}</div>
          : messages.map((m: ChatMessageDto) => {
            const me = m.senderId === userId;
            return (
              <div key={m.id} className={`mc-bub ${me ? 'me' : 'them'}`}>
                {m.body}
                <div className="mc-bt">{new Date(m.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}{me && (m.isRead ? ' ✓✓' : ' ✓')}</div>
              </div>
            );
          })}
      </div>

      <form className="mc-composer" onSubmit={handleSend}>
        <div className="mc-input-wrap">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('Skriv ett meddelande…')}
            autoComplete="off"
            aria-label="Meddelande"
          />
          <button className={`mc-send${body.trim() ? ' has-text' : ''}`} type="submit" disabled={send.isPending || !body.trim()} aria-label="Skicka">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </form>
    </div>
  );
}
