import { useState } from 'react';
import type { CSSProperties } from 'react';
import { t } from '@/lib/i18n';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API can be blocked (permissions, older WebViews) — fall back
    // to the hidden-textarea trick so one-tap copy always works.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* nothing more we can do */ }
    document.body.removeChild(ta);
  }
}

// ── One-tap copy button with "Kopierad!" feedback ──────
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={t('Kopiera')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
        borderRadius: 980, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
        fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', letterSpacing: '.01em',
        color: copied ? '#fff' : '#3a1d12',
        background: copied ? 'linear-gradient(135deg,#3dbb77,#2f9d5b)' : 'linear-gradient(135deg,#FFD8C7,#F1A88F)',
        boxShadow: copied ? '0 6px 16px rgba(47,157,91,.3)' : '0 6px 16px rgba(241,168,143,.35)',
        transition: 'all .2s',
      }}
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg>
          {t('Kopierad!')}
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
          {t('Kopiera')}
        </>
      )}
    </button>
  );
}

// ── Labeled value row with a copy button ───────────────
export function CopyField({ icon, label, value, hint }: { icon?: string; label: string; value: string; hint?: string }) {
  const iconStyle: CSSProperties = {
    width: 36, height: 36, borderRadius: 11, flex: '0 0 36px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', color: '#9c4f31',
    fontWeight: 800, fontSize: 16,
  };
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0,
        padding: '12px 14px', borderRadius: 15,
        border: '1px solid rgba(241,168,143,.28)',
        background: 'linear-gradient(160deg,#fff,#FFF6F0)',
      }}
    >
      {icon && <span style={iconStyle} aria-hidden>{icon}</span>}
      <div style={{ flex: '1 1 170px', minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700, fontSize: 14, color: '#0B0F17', wordBreak: 'break-word', marginTop: 2, lineHeight: 1.45 }}>{value}</div>
        {hint && <div style={{ fontSize: 11.5, color: '#9c6b1c', marginTop: 3 }}>⚠ {hint}</div>}
      </div>
      <CopyButton text={value} />
    </div>
  );
}
