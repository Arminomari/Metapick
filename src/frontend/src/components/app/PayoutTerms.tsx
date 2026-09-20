/** Plain-language payout terms and the "what would I earn" slider. Uses the existing estimator. */
import { useState } from 'react';
import { t } from '@/lib/i18n';
import { money, formatNumber } from '@/lib/utils';
import type { PayoutRule } from '@/types';

/**
 * Client-side mirror of the backend payout calculators: an estimate shown
 * before applying, never the authoritative amount (that is computed
 * server-side from verified views).
 */
export function estimatePayout(model: string, rules: PayoutRule[] | undefined, views: number): number {
  if (!rules?.length) return 0;
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  let total = 0;
  if (model === 'CPM') {
    const r = sorted.find((x) => x.payoutType === 'CPM') ?? sorted[0];
    total = (views / 1000) * r.amount;
    if (r.maxPayoutPerCreator) total = Math.min(total, r.maxPayoutPerCreator);
  } else if (model === 'Tiered') {
    const byTierDesc = [...sorted].sort((a, b) => b.minViews - a.minViews);
    const matched = byTierDesc.find((r) => views >= r.minViews);
    total = matched?.amount ?? 0;
    if (matched?.maxPayoutPerCreator) total = Math.min(total, matched.maxPayoutPerCreator);
  } else if (model === 'Hybrid') {
    const base = sorted.find((r) => r.payoutType === 'FixedThreshold');
    if (!base || views < base.minViews) return 0;
    total = base.amount;
    for (const b of sorted.filter((r) => r.payoutType === 'BonusAboveThreshold')) if (views >= b.minViews) total += b.amount;
    const caps = sorted.filter((r) => r.maxPayoutPerCreator != null).map((r) => r.maxPayoutPerCreator as number);
    if (caps.length) total = Math.min(total, Math.min(...caps));
  } else {
    const qualifying = sorted.filter((r) => views >= r.minViews).sort((a, b) => b.minViews - a.minViews);
    const r = qualifying[0];
    total = r?.amount ?? 0;
    if (r?.maxPayoutPerCreator) total = Math.min(total, r.maxPayoutPerCreator);
  }
  return Math.round(total);
}

export function describeRule(r: PayoutRule): string {
  switch (r.payoutType) {
    case 'CPM': return `${r.amount} ${t('kr per 1 000 visningar')}`;
    case 'FixedThreshold': return `${money(r.amount)} ${t('när du når')} ${formatNumber(r.minViews)} ${t('visningar')}`;
    case 'BonusAboveThreshold': return `+${money(r.amount)} ${t('bonus över')} ${formatNumber(r.minViews)} ${t('visningar')}`;
    case 'Tiered': return r.maxViews ? `${money(r.amount)} ${t('vid')} ${formatNumber(r.minViews)}–${formatNumber(r.maxViews)} ${t('visningar')}` : `${money(r.amount)} ${t('vid')} ${formatNumber(r.minViews)}+ ${t('visningar')}`;
    default: return money(r.amount);
  }
}

export function payoutHeadline(model: string, rules?: PayoutRule[]): string {
  const r = rules?.[0];
  if (model === 'CPM') return `${r?.amount ?? 0} ${t('kr / 1 000 views')}`;
  if (model === 'Tiered') return t('Trappsteg per views');
  return `${r?.amount ?? 0} ${t('kr vid')} ${formatNumber(r?.minViews ?? 0)}+ views`;
}

export function PayoutTerms({ rules, minViews }: { rules: PayoutRule[]; minViews?: number }) {
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  const cap = sorted.find((r) => r.maxPayoutPerCreator)?.maxPayoutPerCreator;
  return (
    <div className="ds-facts">
      {sorted.map((r, i) => <div key={i} className="ds-fact"><span>{describeRule(r)}</span><span /></div>)}
      {cap != null && <div className="ds-fact"><span>{t('Maxersättning per creator')}</span><span className="ds-num">{money(cap)}</span></div>}
      {minViews != null && minViews > 0 && <div className="ds-fact"><span>{t('Visningar krävs för utbetalning')}</span><span className="ds-num">{formatNumber(minViews)}+</span></div>}
    </div>
  );
}

export function PayoutEstimator({ model, rules }: { model: string; rules: PayoutRule[] }) {
  const [views, setViews] = useState(25_000);
  const only = rules.length === 1 ? rules[0] : null;
  if (only && only.payoutType === 'FixedThreshold') {
    return <p className="ds-caption ds-muted">{t('Fast ersättning')}: {money(only.amount)} {t('från')} {formatNumber(only.minViews)} {t('visningar')}. {t('Under tröskeln utgår ingen ersättning.')}</p>;
  }
  return (
    <div className="ds-stack">
      <div className="ds-fact"><span className="ds-num">{formatNumber(views)} {t('visningar')}</span><span className="ds-num">≈ {money(estimatePayout(model, rules, views))}</span></div>
      <input type="range" min={0} max={500_000} step={1000} value={views} onChange={(e) => setViews(Number(e.target.value))} aria-label={t('Antal visningar')} style={{ width: '100%', accentColor: 'var(--ds-accent)' }} />
      <p className="ds-caption ds-muted">{t('Uppskattning — den faktiska ersättningen beräknas på verifierade visningar.')}</p>
    </div>
  );
}
