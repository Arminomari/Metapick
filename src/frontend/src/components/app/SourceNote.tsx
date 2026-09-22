/**
 * The one way a SYSTEM_COMPUTED number states where it came from and how
 * fresh it is: "Verifierad via TikTok · uppdaterad 11 min sedan · alla
 * kampanjvideos". Every stat block renders one of these; none renders a
 * number without it.
 */
import { t } from '@/lib/i18n';
import { ago } from '@/components/app/common';

export type SourceKind = 'tiktok' | 'ledger' | 'vyrle' | 'declared';

const LABEL: Record<SourceKind, string> = {
  tiktok: 'Verifierad via TikTok',
  ledger: 'Från utbetalningsboken',
  vyrle: 'Uppmätt av VYRLE',
  declared: 'Deklarerat av motparten — inte verifierat',
};

export function SourceNote({ source, at, scope, style }: { source: SourceKind; at?: string | null; scope?: string; style?: React.CSSProperties }) {
  const parts = [t(LABEL[source])];
  if (at) parts.push(`${t('uppdaterad')} ${ago(at)}`);
  else if (source === 'tiktok') parts.push(t('inte synkad än'));
  if (scope) parts.push(scope);
  return <p className="ds-caption ds-muted" style={{ margin: '6px 0 0', ...style }}>{parts.join(' · ')}</p>;
}

/** "–" for a ratio the server could not compute (no denominator yet). */
export function orDash<T>(v: T | null | undefined, f: (x: T) => string): string {
  return v === null || v === undefined ? '–' : f(v);
}
