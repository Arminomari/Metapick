import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import { useToast, CardSkeleton } from '@/components/vyrle/Toast';
import { useChatConversations, useActionCounts } from '@/hooks/api';
import { useAuthStore } from '@/stores/authStore';
import { ConversationList, ChatThread } from '@/components/layout/ShellDrawers';
import type { ApiResponse, ChatConversationDto } from '@/types';

export interface SupportMessage {
  id: string;
  body: string;
  fromAdmin: boolean;
  senderName: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * Everything someone has written to you, on one page: the conversations with
 * the other side of a collaboration, and the line to VYRLE's team. The header
 * chat icon opens the same conversations as a quick drawer — this page is
 * where the sidebar item and every "new message" notification lead.
 */
export function SupportThreadPage() {
  const [params, setParams] = useSearchParams();
  const { role } = useAuthStore();
  const { data: convos = [], isLoading: loadingConvos } = useChatConversations();
  const { data: counts } = useActionCounts(role === 'Brand' ? 'brand' : 'creator');
  const [sel, setSel] = useState<ChatConversationDto | null>(null);

  const unreadChat = convos.reduce((s, c) => s + (c.unreadCount || 0), 0);
  const unreadSupport = counts?.unreadSupport ?? 0;
  const asked = params.get('tab');
  // No explicit choice: open where something is waiting, conversations first.
  const tab: 'chat' | 'support' = asked === 'support' ? 'support'
    : asked === 'chat' ? 'chat'
    : unreadSupport > 0 && unreadChat === 0 ? 'support'
    : !loadingConvos && convos.length === 0 ? 'support' : 'chat';
  const pick = (next: 'chat' | 'support') => { setSel(null); setParams({ tab: next }, { replace: true }); };

  const Count = ({ n }: { n: number }) => n > 0 ? <span className="vy-badge neg" style={{ marginLeft: 8 }}>{n > 9 ? '9+' : n}</span> : null;

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Dina')} <em>{t('meddelanden')}</em></h1>
          <p className="page-sub">{tab === 'chat'
            ? t('Konversationer med dem du samarbetar med. Varje tråd hör till en kampanj eller ett uppdrag.')
            : t('Din direktlinje till teamet bakom plattformen. Vi ser ditt svar direkt — och du får våra meddelanden både här och på mejlen.')}</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'chat'} className={`tab${tab === 'chat' ? ' active' : ''}`} onClick={() => pick('chat')}>{t('Konversationer')}<Count n={unreadChat} /></button>
        <button type="button" role="tab" aria-selected={tab === 'support'} className={`tab${tab === 'support' ? ' active' : ''}`} onClick={() => pick('support')}>{t('Support från VYRLE')}<Count n={unreadSupport} /></button>
      </div>

      {tab === 'chat' ? (
        <div className="card" style={{ position: 'relative', height: 'min(640px, 72vh)', minHeight: 420, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
          <ConversationList onOpen={setSel} />
          <ChatThread sel={sel} onBack={() => setSel(null)} />
        </div>
      ) : <SupportThreadCard />}
    </section>
  );
}

/** The user's one thread with VYRLE's team. Opening it marks the team's messages as read. */
function SupportThreadCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['support-thread'],
    queryFn: async () => (await api.get<ApiResponse<SupportMessage[]>>('/messages')).data.data,
    refetchInterval: 30000,
  });

  // Reading the thread clears the red badge in the sidebar.
  useEffect(() => {
    if (messages.length) qc.invalidateQueries({ queryKey: ['action-counts'] });
  }, [messages.length, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const reply = useMutation({
    mutationFn: async (text: string) =>
      (await api.post<ApiResponse<SupportMessage>>('/messages', { body: text })).data.data,
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['support-thread'] });
      toast.push(t('Skickat! VYRLE-teamet får en notis direkt.'), 'success');
    },
    onError: (e: any) => toast.push(e?.response?.data?.error?.message ?? t('Kunde inte skicka meddelandet'), 'error'),
  });

  const send = () => {
    const text = body.trim();
    if (text && !reply.isPending) reply.mutate(text);
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px', overflowY: 'auto', maxHeight: '55vh' }}>
        {isLoading ? <CardSkeleton rows={3} /> : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0B0F17' }}>{t('Inga meddelanden ännu')}</div>
            <div style={{ fontSize: 13.5, marginTop: 6, maxWidth: 400, marginInline: 'auto', lineHeight: 1.6 }}>
              {t('Har du en fråga om ditt konto, en utbetalning eller något annat? Skriv nedan så svarar teamet så fort de kan.')}
            </div>
          </div>
        ) : messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.fromAdmin ? 'flex-start' : 'flex-end' }}>
            <div style={{
              maxWidth: 'min(78%, 520px)', padding: '10px 14px', borderRadius: 16,
              borderBottomLeftRadius: m.fromAdmin ? 5 : 16, borderBottomRightRadius: m.fromAdmin ? 16 : 5,
              background: m.fromAdmin ? 'linear-gradient(140deg,#FFF4EC,#FFE9DC)' : 'linear-gradient(135deg,#1A2230,#0B0F17)',
              color: m.fromAdmin ? '#0B0F17' : '#FFF4EC',
              border: m.fromAdmin ? '1px solid rgba(241,168,143,.3)' : 'none',
            }}>
              {m.fromAdmin && (
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: '#C26A4A', marginBottom: 3 }}>
                  ✦ VYRLE
                </div>
              )}
              <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{m.body}</div>
              <div style={{ fontSize: 10.5, marginTop: 5, opacity: .62 }}>{formatDate(m.createdAt)}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(241,168,143,.2)', flexWrap: 'wrap' }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={2}
          maxLength={4000}
          placeholder={t('Skriv till VYRLE-teamet…')}
          aria-label={t('Skriv till VYRLE-teamet…')}
          style={{
            flex: '1 1 240px', minWidth: 0, borderRadius: 14, border: '1px solid rgba(241,168,143,.3)',
            background: 'rgba(255,255,255,.85)', padding: '11px 14px', fontSize: 14,
            fontFamily: 'inherit', color: '#0B0F17', resize: 'none', lineHeight: 1.5,
          }}
        />
        <button type="button" className="btn-apply" style={{ width: 'auto', padding: '11px 22px', alignSelf: 'flex-end', flex: '0 0 auto' }}
          disabled={!body.trim() || reply.isPending} onClick={send}>
          {reply.isPending ? t('Skickar…') : t('Skicka')}
        </button>
      </div>
    </div>
  );
}
