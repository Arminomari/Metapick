/**
 * Chat in the design system: conversation list, a thread, and the inline
 * panel used on assignment screens. Same hooks and endpoints as before.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useChatConversations, useChatMessages, useSendMessage, useMarkChatRead } from '@/hooks/api';
import type { ChatConversationDto, ChatMessageDto } from '@/types';
import { Avatar, Count, EmptyState, IconButton, List, ListRow, SkeletonList } from '@/components/ds';
import { ago } from './common';

export function ConversationList({ onOpen, pinned }: { onOpen: (c: ChatConversationDto) => void; pinned?: React.ReactNode }) {
  const { data: convos = [], isLoading } = useChatConversations();
  if (isLoading) return <SkeletonList rows={3} />;
  return (
    <List>
      {pinned}
      {convos.length === 0 && !pinned && <EmptyState title={t('Inga konversationer än')} description={t('När ett samarbete startar kan ni chatta här.')} />}
      {convos.map((c) => (
        <ListRow key={c.threadId} leading={<Avatar name={c.counterpartName} src={c.counterpartImageUrl} />}
          title={c.counterpartName} badge={c.unreadCount > 0 ? <Count n={c.unreadCount} /> : undefined}
          subtitle={`${c.campaignName}${c.lastMessage ? ` · ${c.lastMessage}` : ''}`}
          trailing={c.lastMessageAt ? <span className="ds-caption ds-muted">{ago(c.lastMessageAt)}</span> : undefined}
          onClick={() => onOpen(c)} />
      ))}
    </List>
  );
}

function Bubbles({ messages, mine, loading }: { messages: ChatMessageDto[]; mine: (m: ChatMessageDto) => boolean; loading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [messages]);
  return (
    <div className="ds-thread" ref={ref} style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {loading ? <div className="ds-caption ds-muted" style={{ textAlign: 'center' }}>{t('Laddar…')}</div>
        : messages.length === 0 ? <div className="ds-caption ds-muted" style={{ textAlign: 'center', padding: 16 }}>{t('Starta konversationen')}</div>
        : messages.map((m) => {
          const me = mine(m);
          return (
            <div key={m.id} className={`ds-bubble ${me ? 'ds-bubble--me' : 'ds-bubble--them'}`}>
              {m.body}
              <div className="ds-bubble-meta">{new Date(m.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}{me && (m.isRead ? ' ✓✓' : ' ✓')}</div>
            </div>
          );
        })}
    </div>
  );
}

export function Composer({ onSend, busy, placeholder }: { onSend: (text: string) => Promise<void> | void; busy?: boolean; placeholder?: string }) {
  const [body, setBody] = useState('');
  const submit = async () => { const text = body.trim(); if (!text || busy) return; setBody(''); try { await onSend(text); } catch { setBody(text); } };
  return (
    <div className="ds-composer">
      <textarea className="ds-input" rows={1} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder ?? t('Skriv ett meddelande…')} aria-label={t('Meddelande')}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }} />
      <IconButton label={t('Skicka')} boxed onClick={() => void submit()} disabled={busy || !body.trim()} style={{ background: body.trim() ? 'var(--ds-accent)' : undefined, color: body.trim() ? '#fff' : undefined, borderColor: body.trim() ? 'var(--ds-accent)' : undefined }}><Send /></IconButton>
    </div>
  );
}

/** A thread with the person on the other side of a campaign, keyed by thread id. */
export function ChatThread({ threadId, height = 'min(60vh, 520px)' }: { threadId: string; height?: string }) {
  const { userId } = useAuthStore();
  const { data: messages = [], isLoading } = useChatMessages(threadId);
  const send = useSendMessage();
  const markRead = useMarkChatRead();
  useEffect(() => { if (threadId) markRead.mutate(threadId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [threadId]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height }}>
      <Bubbles messages={messages} mine={(m) => m.senderId === userId} loading={isLoading} />
      <Composer busy={send.isPending} onSend={(text) => send.mutateAsync({ assignmentId: threadId, body: text }).then(() => undefined)} />
    </div>
  );
}

/** Header for a thread: the counterpart, tappable to their profile. */
export function ThreadHeader({ convo }: { convo: ChatConversationDto }) {
  const navigate = useNavigate();
  const to = convo.counterpartRole === 'Creator' && convo.counterpartProfileId ? `/brand/creators/${convo.counterpartProfileId}`
    : convo.counterpartRole === 'Brand' && convo.counterpartProfileId ? `/creator/brands/${convo.counterpartProfileId}` : null;
  return (
    <ListRow leading={<Avatar name={convo.counterpartName} src={convo.counterpartImageUrl} size="sm" />} title={convo.counterpartName} subtitle={convo.campaignName}
      onClick={to ? () => navigate(to) : undefined} chevron={!!to} className="ds-listrow--flush" />
  );
}

/** Inline chat on an assignment screen. */
export function ChatPanel({ assignmentId }: { assignmentId: string }) {
  const { data: convos = [] } = useChatConversations();
  const convo = convos.find((c) => c.threadId === assignmentId || c.assignmentId === assignmentId);
  return (
    <div>
      {convo && <ThreadHeader convo={convo} />}
      <ChatThread threadId={assignmentId} height="min(50vh, 420px)" />
    </div>
  );
}
