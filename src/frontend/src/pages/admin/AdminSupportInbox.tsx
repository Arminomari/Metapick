import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types';

interface SupportMessage {
  id: string; body: string; fromAdmin: boolean; senderName: string; isRead: boolean; createdAt: string;
}
interface SupportThread {
  userId: string; name: string; email: string; role: string; status: string;
  lastMessage: string; lastFromAdmin: boolean; lastAt: string; unreadFromUser: number; messageCount: number;
}

const card: React.CSSProperties = { background: 'rgba(255,255,255,.82)', border: '1px solid rgba(255,255,255,.7)', borderRadius: 24, padding: '1.1rem clamp(.9rem, 3.5vw, 1.3rem)', marginBottom: '1rem', minWidth: 0, boxShadow: '0 10px 34px rgba(180,120,90,.08), 0 2px 8px rgba(11,15,23,.04)' };
const mutedTx: React.CSSProperties = { color: '#6E7480', fontSize: '.8rem' };

export function useAdminUnreadThreads() {
  return useQuery({
    queryKey: ['admin-support-threads'],
    queryFn: async () => (await api.get<ApiResponse<SupportThread[]>>('/admin/messages')).data.data,
    refetchInterval: 30000,
  });
}

/* ── Inbox: every user thread, unread replies first ───────────────── */
export function AdminSupportInboxCard({ onOpenThread }: { onOpenThread: (userId: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data: threads = [], isLoading } = useAdminUnreadThreads();
  const unread = threads.reduce((s, th) => s + th.unreadFromUser, 0);

  return (
    <div style={card}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '.92rem', color: '#0B0F17', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {open ? '▾' : '▸'} {t('Inkorg — svar från användare')}
        {unread > 0 && <span style={{ background: '#C26A4A', color: '#fff', borderRadius: 999, fontSize: '.7rem', fontWeight: 700, padding: '1px 8px' }}>{unread}</span>}
      </button>
      <div style={{ ...mutedTx, marginTop: 2 }}>{t('Alla konversationer med enskilda användare. Svara härifrån eller från användarens rad nedan.')}</div>

      {open && (
        <div style={{ marginTop: '.9rem', display: 'grid', gap: '.5rem' }}>
          {isLoading && <div style={mutedTx}>{t('Laddar…')}</div>}
          {!isLoading && threads.length === 0 && <div style={mutedTx}>{t('Inga konversationer än — skriv till en användare via ✉️ på deras rad.')}</div>}
          {threads.map((th) => (
            <button key={th.userId} type="button" onClick={() => onOpenThread(th.userId, th.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', minWidth: 0,
                padding: '.7rem .85rem', borderRadius: 14, border: '1px solid rgba(241,168,143,.22)',
                background: th.unreadFromUser > 0 ? 'rgba(255,216,199,.35)' : 'rgba(255,255,255,.7)',
              }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '.88rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {th.name}
                  <span style={{ fontSize: '.68rem', fontWeight: 600, color: th.role === 'Creator' ? '#9c4f31' : '#6a4ea8' }}>{th.role}</span>
                  {th.unreadFromUser > 0 && <span style={{ background: '#C26A4A', color: '#fff', borderRadius: 999, fontSize: '.66rem', fontWeight: 700, padding: '1px 7px' }}>{th.unreadFromUser} {t('nya')}</span>}
                </div>
                <div style={{ fontSize: '.78rem', color: '#6E7480', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {th.lastFromAdmin ? `${t('Du')}: ` : ''}{th.lastMessage}
                </div>
              </div>
              <div style={{ fontSize: '.72rem', color: '#B7BCC8', flex: '0 0 auto' }}>{formatDate(th.lastAt)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── One user's thread: history + composer ────────────────────────── */
export function AdminUserThreadModal({ userId, userName, onClose }: { userId: string; userName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['admin-support-thread', userId],
    queryFn: async () => (await api.get<ApiResponse<SupportMessage[]>>(`/admin/users/${userId}/messages`)).data.data,
    refetchInterval: 20000,
  });

  // Opening the thread reads the user's replies — the inbox badge follows.
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['admin-support-threads'] });
  }, [messages.length, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = useMutation({
    mutationFn: async () =>
      (await api.post<ApiResponse<SupportMessage>>(`/admin/users/${userId}/messages`, { body: body.trim(), sendEmail })).data.data,
    onSuccess: () => {
      setBody(''); setErr('');
      qc.invalidateQueries({ queryKey: ['admin-support-thread', userId] });
      qc.invalidateQueries({ queryKey: ['admin-support-threads'] });
    },
    onError: (e: any) => setErr(e?.response?.data?.error?.message ?? t('Kunde inte skicka meddelandet')),
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,23,.45)', backdropFilter: 'blur(3px)', zIndex: 80 }} aria-hidden />
      <div role="dialog" aria-modal="true"
        style={{
          position: 'fixed', zIndex: 81, top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(600px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(160deg,#fff,#FFF9F5)', borderRadius: 24,
          border: '1px solid rgba(241,168,143,.35)', boxShadow: '0 30px 80px rgba(11,15,23,.28)',
          padding: 'clamp(16px, 4.5vw, 24px)',
        }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, wordBreak: 'break-word' }}>✉️ {userName}</h2>
            <div style={{ fontSize: 12, color: '#6E7480', marginTop: 3 }}>
              {t('Användaren får en notis i appen och (valfritt) ett mejl — svaret kommer tillbaka hit.')}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Stäng')} style={{ border: 'none', background: 'rgba(183,188,200,.2)', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 16, color: '#5a606d', flex: '0 0 auto' }}>×</button>
        </div>

        <div style={{ flex: 1, minHeight: 160, maxHeight: '46vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, paddingRight: 4 }}>
          {isLoading && <div style={{ ...mutedTx, padding: '1rem 0' }}>{t('Laddar…')}</div>}
          {!isLoading && messages.length === 0 && (
            <div style={{ ...mutedTx, padding: '1.2rem 0', textAlign: 'center' }}>{t('Ingen konversation än — skriv det första meddelandet nedan.')}</div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.fromAdmin ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '9px 13px', borderRadius: 14,
                borderBottomRightRadius: m.fromAdmin ? 4 : 14, borderBottomLeftRadius: m.fromAdmin ? 14 : 4,
                background: m.fromAdmin ? 'linear-gradient(135deg,#1A2230,#0B0F17)' : 'rgba(255,216,199,.4)',
                color: m.fromAdmin ? '#FFF4EC' : '#0B0F17',
              }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{m.body}</div>
                <div style={{ fontSize: 10, marginTop: 4, opacity: .62 }}>{m.fromAdmin ? 'VYRLE' : m.senderName} · {formatDate(m.createdAt)}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(241,168,143,.2)' }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (body.trim() && !send.isPending) send.mutate(); } }}
            rows={3}
            maxLength={4000}
            autoFocus
            placeholder={t('Skriv till användaren…')}
            style={{ width: '100%', minWidth: 0, borderRadius: 14, border: '1px solid rgba(241,168,143,.3)', background: '#fff', padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit', color: '#0B0F17', resize: 'vertical', lineHeight: 1.5 }}
          />
          {err && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: '#cf4b4b' }}>{err}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.8rem', color: '#2C333F', cursor: 'pointer' }}>
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              {t('Skicka även som mejl')}
            </label>
            <button type="button" disabled={!body.trim() || send.isPending} onClick={() => send.mutate()}
              style={{ marginLeft: 'auto', padding: '.6rem 1.5rem', borderRadius: 980, background: 'linear-gradient(135deg,#1A2230,#0B0F17)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer', opacity: !body.trim() || send.isPending ? .6 : 1 }}>
              {send.isPending ? t('Skickar…') : t('Skicka')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
