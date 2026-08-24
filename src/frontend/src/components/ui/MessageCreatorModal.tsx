import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { useToast } from '@/components/vyrle/Toast';

/**
 * Brand → creator direct message. Brands may open a thread with any creator;
 * creators can only reply, never cold-message a brand (enforced server-side).
 */
export function MessageCreatorModal({
  creatorProfileId,
  creatorName,
  onClose,
}: {
  creatorProfileId: string;
  creatorName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setErr('');
    try {
      await api.post(`/chat/d-${creatorProfileId}`, { body: text });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-unread'] });
      toast.push(`${t('Meddelandet är skickat till')} ${creatorName}`, 'success');
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? t('Kunde inte skicka meddelandet'));
    }
    setBusy(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,23,.45)', backdropFilter: 'blur(3px)', zIndex: 80 }} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', zIndex: 81, top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(520px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto',
          background: 'linear-gradient(160deg,#fff,#FFF9F5)', borderRadius: 24,
          border: '1px solid rgba(241,168,143,.35)', boxShadow: '0 30px 80px rgba(11,15,23,.28)',
          padding: 'clamp(18px, 5vw, 26px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, wordBreak: 'break-word' }}>{t('Skriv till')} {creatorName}</h2>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{t('Hamnar direkt i creatorns meddelanden — hen kan svara här.')}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Stäng')} style={{ border: 'none', background: 'rgba(183,188,200,.2)', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 16, color: '#5a606d', flex: '0 0 auto' }}>×</button>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={2000}
          autoFocus
          placeholder={t('Hej! Vi gillar ditt innehåll och skulle vilja samarbeta…')}
          style={{
            width: '100%', marginTop: 14, borderRadius: 14, border: '1px solid rgba(241,168,143,.3)',
            background: 'rgba(255,255,255,.85)', padding: '12px 14px', fontSize: 14,
            fontFamily: 'inherit', color: '#0B0F17', resize: 'vertical', lineHeight: 1.55, minWidth: 0,
          }}
        />
        {err && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: '#cf4b4b' }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="button" className="btn-apply" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => void send()} disabled={busy || !body.trim()}>
            {busy ? t('Skickar…') : t('Skicka meddelande')}
          </button>
          <button type="button" className="btn-outline" style={{ width: 'auto', padding: '12px 24px' }} onClick={onClose}>{t('Avbryt')}</button>
        </div>
      </div>
    </>
  );
}
