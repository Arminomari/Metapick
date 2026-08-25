import { useState } from 'react';
import { t } from '@/lib/i18n';

/**
 * Applying is a pitch, not a button press: the creator says in their own
 * words why they fit, and that text is what the brand reads next to the
 * profile when deciding.
 */
export function ApplyModal({
  campaignName,
  brandName,
  busy,
  onClose,
  onSubmit,
}: {
  campaignName: string;
  brandName?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
}) {
  const [message, setMessage] = useState('');
  const ready = message.trim().length >= 10;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,23,.45)', backdropFilter: 'blur(3px)', zIndex: 80 }} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', zIndex: 81, top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(540px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto',
          background: 'linear-gradient(160deg,#fff,#FFF9F5)', borderRadius: 24,
          border: '1px solid rgba(241,168,143,.35)', boxShadow: '0 30px 80px rgba(11,15,23,.28)',
          padding: 'clamp(18px, 5vw, 26px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, wordBreak: 'break-word' }}>
              {t('Ansök till')} {campaignName}
            </h2>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              {brandName ? `${brandName} · ` : ''}{t('Det du skriver här är det första företaget läser om dig.')}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Stäng')} style={{ border: 'none', background: 'rgba(183,188,200,.2)', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 16, color: '#5a606d', flex: '0 0 auto' }}>×</button>
        </div>

        <label style={{ display: 'block', marginTop: 16, fontSize: 13, fontWeight: 700 }}>
          {t('Varför passar just du för den här kampanjen?')}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={1000}
          autoFocus
          placeholder={t('Berätta kort: vad du skapar, vem som följer dig och varför den här produkten känns rätt för din publik…')}
          style={{
            width: '100%', marginTop: 8, borderRadius: 14, border: '1px solid rgba(241,168,143,.3)',
            background: 'rgba(255,255,255,.85)', padding: '12px 14px', fontSize: 14,
            fontFamily: 'inherit', color: '#0B0F17', resize: 'vertical', lineHeight: 1.55, minWidth: 0,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, fontSize: 11.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <span>{ready ? t('Bra — konkret slår långt.') : t('Minst 10 tecken.')}</span>
          <span>{message.length}/1000</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-apply"
            style={{ width: 'auto', padding: '12px 24px', flex: '1 1 auto' }}
            disabled={!ready || busy}
            onClick={() => onSubmit(message.trim())}
          >
            {busy ? t('Skickar…') : t('Skicka ansökan')}
          </button>
          <button type="button" className="btn-outline" style={{ padding: '12px 20px', flex: '0 0 auto' }} onClick={onClose}>
            {t('Avbryt')}
          </button>
        </div>
      </div>
    </>
  );
}
