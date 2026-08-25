import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import { useToast, CardSkeleton } from '@/components/vyrle/Toast';
import type { ApiResponse } from '@/types';

export interface SupportMessage {
  id: string;
  body: string;
  fromAdmin: boolean;
  senderName: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * The user's one thread with VYRLE's team. Opening it marks the team's
 * messages as read; a reply lands with every admin — notification and mail.
 */
export function SupportThreadPage() {
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
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Meddelanden från')} <em>VYRLE</em></h1>
          <p className="page-sub">{t('Din direktlinje till teamet bakom plattformen. Vi ser ditt svar direkt — och du får våra meddelanden både här och på mejlen.')}</p>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px', overflowY: 'auto', maxHeight: '55vh' }}>
          {isLoading ? <CardSkeleton rows={3} /> : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }} aria-hidden>✉️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0B0F17' }}>{t('Inga meddelanden än')}</div>
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
    </section>
  );
}
