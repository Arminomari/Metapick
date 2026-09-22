import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { lang, t } from '@/lib/i18n';
import { canonicalCategory } from '@/lib/categories';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Formatting ─────────────────────────────────────────────────────
// Every number, amount and date on screen goes through these, so the whole
// product speaks one locale at a time: "500,00 kr · 17 sep. 2026" in Swedish,
// "SEK 500.00 · 17 Sept 2026" in English.
const LOCALE = lang === 'en' ? 'en-GB' : 'sv-SE';

export function formatCurrency(amount: number, currency = 'SEK'): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amount);
}

/** Whole kronor unless there are öre: "1 070 kr", "620,50 kr". For tiles and list rows. */
export function money(amount: number, currency = 'SEK'): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

/** 120K / 1,2M for tight chips. Plain digits under a thousand. */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.0', '').replace('.', ',')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n);
}

const validDate = (date: string | Date) => { const d = new Date(date); return isNaN(d.getTime()) ? null : d; };

export function formatDate(date: string | Date): string {
  const d = validDate(date);
  return d ? d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function formatDateTime(date: string | Date): string {
  const d = validDate(date);
  return d ? d.toLocaleString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

/** "juni 2026" — for member-since and similar. */
export function formatMonthYear(date: string | Date): string {
  const d = validDate(date);
  return d ? d.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }) : '—';
}

/** "1 plats" / "3 platser" — pass the already translated forms. */
export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

const COUNTRY_SV: Record<string, string> = { SE: 'Sverige', NO: 'Norge', DK: 'Danmark', FI: 'Finland' };
export function countryName(code?: string | null): string {
  if (!code) return '';
  return COUNTRY_SV[code] ? t(COUNTRY_SV[code]) : code;
}

// Older stored names (and English ones) read as today's category.
export function categoryLabel(value?: string | null): string {
  if (!value) return '';
  return t(canonicalCategory(value));
}

const PAYOUT_MODEL_SV: Record<string, string> = { Fixed: 'Fast belopp', FixedThreshold: 'Fast belopp', CPM: 'Per visning', Tiered: 'Trappa', Hybrid: 'Hybrid' };
export function payoutModelLabel(model?: string | null): string {
  if (!model) return '';
  return t(PAYOUT_MODEL_SV[model] ?? model);
}

// The API sends the compensation as one English-formatted sentence
// ("500.00 SEK vid 1,000+ views"). Re-render it in the active locale.
function parseAmount(raw: string): number {
  let v = raw.replace(/[\s\u00a0]/g, '');
  if (v.includes(',') && v.includes('.')) v = v.replace(/,/g, '');
  else if (/^\d{1,3}(,\d{3})+$/.test(v)) v = v.replace(/,/g, '');
  else v = v.replace(',', '.');
  return Number(v);
}
export function payoutSummaryText(raw?: string | null): string {
  if (!raw) return '';
  const N = '([\\d.,\\s\\u00a0]+)';
  let m = raw.match(new RegExp(`^${N} SEK per 1000 views(?: \\(max ${N} SEK\\))?$`));
  if (m) return `${formatCurrency(parseAmount(m[1]))} ${t('per 1 000 views')}` + (m[2] ? ` (${t('max')} ${formatCurrency(parseAmount(m[2]))})` : '');
  m = raw.match(new RegExp(`^${N} SEK vid ${N}\\+ views$`));
  if (m) return `${formatCurrency(parseAmount(m[1]))} ${t('vid')} ${formatNumber(parseAmount(m[2]))}+ views`;
  m = raw.match(new RegExp(`^${N}–${N} SEK( beroende på views)?$`));
  if (m) return `${formatCurrency(parseAmount(m[1]))}–${formatCurrency(parseAmount(m[2]))}` + (m[3] ? ` ${t('beroende på views')}` : '');
  m = raw.match(new RegExp(`^${N} SEK$`));
  if (m) return formatCurrency(parseAmount(m[1]));
  return raw === 'Ej konfigurerad' ? t('Ej konfigurerad') : raw;
}

export function getStatusColor(status: string): string {
  // Warm editorial palette — soft tinted backgrounds, deep ink foregrounds.
  const colors: Record<string, string> = {
    Active:               'bg-[hsl(90_22%_32%_/_0.12)]  text-[hsl(90_22%_24%)]   ring-1 ring-[hsl(90_22%_32%_/_0.25)]',
    Approved:             'bg-[hsl(90_22%_32%_/_0.12)]  text-[hsl(90_22%_24%)]   ring-1 ring-[hsl(90_22%_32%_/_0.25)]',
    GoalReached:          'bg-[hsl(145_45%_45%_/_0.15)] text-[hsl(145_50%_24%)]  ring-1 ring-[hsl(145_45%_40%_/_0.35)]',
    Verified:             'bg-[hsl(90_22%_32%_/_0.12)]  text-[hsl(90_22%_24%)]   ring-1 ring-[hsl(90_22%_32%_/_0.25)]',
    Completed:            'bg-[hsl(28_14%_13%_/_0.06)]  text-[hsl(28_14%_18%)]   ring-1 ring-[hsl(28_14%_13%_/_0.18)]',
    Pending:              'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    PendingApproval:      'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    PendingReview:        'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    PendingVerification:  'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    UnderReview:          'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    AwaitingThreshold:    'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    Processing:           'bg-[hsl(353_36%_92%)]        text-[hsl(353_52%_28%)]  ring-1 ring-[hsl(353_52%_28%_/_0.22)]',
    ReadyForManualPayment:'bg-[hsl(90_22%_32%_/_0.12)]  text-[hsl(90_22%_24%)]   ring-1 ring-[hsl(90_22%_32%_/_0.25)]',
    Draft:                'bg-[hsl(36_22%_82%_/_0.6)]   text-[hsl(28_8%_42%)]    ring-1 ring-[hsl(36_22%_70%)]',
    Paused:               'bg-[hsl(28_65%_38%_/_0.10)]  text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.25)]',
    Rejected:             'bg-[hsl(2_48%_42%_/_0.10)]   text-[hsl(2_48%_32%)]    ring-1 ring-[hsl(2_48%_42%_/_0.25)]',
    Suspended:            'bg-[hsl(2_48%_42%_/_0.10)]   text-[hsl(2_48%_32%)]    ring-1 ring-[hsl(2_48%_42%_/_0.25)]',
    Flagged:              'bg-[hsl(2_48%_42%_/_0.10)]   text-[hsl(2_48%_32%)]    ring-1 ring-[hsl(2_48%_42%_/_0.25)]',
    Failed:               'bg-[hsl(2_48%_42%_/_0.10)]   text-[hsl(2_48%_32%)]    ring-1 ring-[hsl(2_48%_42%_/_0.25)]',
    Cancelled:            'bg-[hsl(36_22%_82%_/_0.6)]   text-[hsl(28_8%_42%)]    ring-1 ring-[hsl(36_22%_70%)]',
  };
  return colors[status] ?? 'bg-[hsl(36_22%_82%_/_0.6)] text-[hsl(28_8%_42%)] ring-1 ring-[hsl(36_22%_70%)]';
}
