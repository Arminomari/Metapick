import { EN } from '@/i18n/en';

export type Lang = 'sv' | 'en';

function readLang(): Lang {
  try {
    return localStorage.getItem('vyrle-lang') === 'en' ? 'en' : 'sv';
  } catch {
    return 'sv';
  }
}

/** Active language for this page load. Switching reloads the page, so every
 *  component reads a single consistent value — no partial re-renders. */
export const lang: Lang = readLang();

/** Translate a Swedish source string. Swedish is the base language; unknown
 *  strings fall back to the Swedish source so nothing ever renders empty. */
export function t(sv: string): string {
  return lang === 'en' ? (EN[sv] ?? sv) : sv;
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  try {
    localStorage.setItem('vyrle-lang', next);
  } catch {
    /* private mode — switch still applies for this load via reload default */
  }
  window.location.reload();
}

/** Backend enums arrive in English PascalCase; render them localized. */
const STATUS_SV: Record<string, string> = {
  Active: 'Aktiv',
  Approved: 'Godkänd',
  Verified: 'Verifierad',
  Completed: 'Slutförd',
  Pending: 'Väntar',
  PendingApproval: 'Väntar på godkännande',
  PendingReview: 'Under granskning',
  PendingVerification: 'Väntar på verifiering',
  UnderReview: 'Under granskning',
  AwaitingThreshold: 'Väntar på tröskel',
  Processing: 'Behandlas',
  ReadyForManualPayment: 'Redo för utbetalning',
  Draft: 'Utkast',
  Paused: 'Pausad',
  Rejected: 'Nekad',
  Failed: 'Misslyckad',
  Cancelled: 'Avbruten',
  Suspended: 'Avstängd',
  Expired: 'Utgången',
  Paid: 'Utbetald',
  InProgress: 'Pågår',
  GoalReached: 'Mål uppnått',
  Submitted: 'Inskickad',
  Preliminary: 'Preliminär',
  Locked: 'Låst',
  Requested: 'Begärd',
  Flagged: 'Flaggad',
  Inactive: 'Inaktiv',
  Open: 'Öppen',
  Closed: 'Stängd',
};

export function statusLabel(status: string): string {
  if (!status) return status;
  if (lang === 'en') return status.replace(/([a-z])([A-Z])/g, '$1 $2');
  return STATUS_SV[status] ?? status;
}

/** SV/EN pill switcher — used in the app topbar and on auth pages. */
export function LangSwitcher() {
  return (
    <div
      role="group"
      aria-label="Språk / Language"
      style={{
        display: 'inline-flex', gap: 2, padding: 3, borderRadius: 980,
        border: '1px solid rgba(241,168,143,.35)', background: 'rgba(255,255,255,.72)',
      }}
    >
      {(['sv', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          style={{
            padding: '4px 10px', borderRadius: 980, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 11, letterSpacing: '.05em', fontFamily: 'inherit',
            background: lang === l ? 'linear-gradient(135deg,#1A2230,#0B0F17)' : 'transparent',
            color: lang === l ? '#fff' : 'rgba(11,15,23,.55)',
            transition: 'all .18s',
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
