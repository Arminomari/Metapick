import { useState } from 'react';
import type { PayoutRule } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * Client-side mirror of the backend payout calculators — an *estimate* shown
 * before applying, never the authoritative amount (that's computed server-side
 * from verified views).
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
    // Mirrors backend TieredPayoutCalculator: highest reached tier, then cap.
    const byTierDesc = [...sorted].sort((a, b) => b.minViews - a.minViews);
    const matched = byTierDesc.find((r) => views >= r.minViews);
    total = matched?.amount ?? 0;
    if (matched?.maxPayoutPerCreator) total = Math.min(total, matched.maxPayoutPerCreator);
  } else if (model === 'Hybrid') {
    // Mirrors backend HybridPayoutCalculator: no base threshold => 0 (bonuses
    // can never apply alone), then the strictest per-creator cap.
    const base = sorted.find((r) => r.payoutType === 'FixedThreshold');
    if (!base || views < base.minViews) return 0;
    total = base.amount;
    for (const b of sorted.filter((r) => r.payoutType === 'BonusAboveThreshold')) {
      if (views >= b.minViews) total += b.amount;
    }
    const caps = sorted.filter((r) => r.maxPayoutPerCreator != null).map((r) => r.maxPayoutPerCreator as number);
    if (caps.length) total = Math.min(total, Math.min(...caps));
  } else {
    // FixedThreshold: the highest qualifying threshold wins (mirrors backend).
    const qualifying = sorted.filter((r) => views >= r.minViews).sort((a, b) => b.minViews - a.minViews);
    const r = qualifying[0];
    total = r?.amount ?? 0;
    if (r?.maxPayoutPerCreator) total = Math.min(total, r.maxPayoutPerCreator);
  }
  return Math.round(total);
}


function describeRule(r: PayoutRule): string {
  switch (r.payoutType) {
    case 'CPM':
      return `${r.amount} ${t('kr per 1 000 visningar')}`;
    case 'FixedThreshold':
      return `${formatCurrency(r.amount)} ${t('när du når')} ${formatNumber(r.minViews)} ${t('visningar')}`;
    case 'BonusAboveThreshold':
      return `+${formatCurrency(r.amount)} ${t('bonus över')} ${formatNumber(r.minViews)} ${t('visningar')}`;
    case 'Tiered':
      return r.maxViews
        ? `${formatCurrency(r.amount)} ${t('vid')} ${formatNumber(r.minViews)}–${formatNumber(r.maxViews)} ${t('visningar')}`
        : `${formatCurrency(r.amount)} ${t('vid')} ${formatNumber(r.minViews)}+ ${t('visningar')}`;
    default:
      return `${formatCurrency(r.amount)}`;
  }
}

/** Plain-Swedish listing of a campaign's payout terms. */
export function PayoutTerms({ rules, minViews }: { rules: PayoutRule[]; minViews?: number }) {
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  const cap = sorted.find((r) => r.maxPayoutPerCreator)?.maxPayoutPerCreator;
  return (
    <div className="pay-rows">
      {sorted.map((r, i) => (
        <div className="pay-row" key={i} style={{ flexWrap: 'wrap' }}>
          <span className="pr-l" style={{ minWidth: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C26A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m5 12 4 4L19 7" /></svg>
            {describeRule(r)}
          </span>
        </div>
      ))}
      {cap != null && (
        <div className="pay-row" style={{ flexWrap: 'wrap' }}>
          <span className="pr-l" style={{ minWidth: 0 }}>{t('Maxersättning per kreatör')}</span>
          <span className="pr-v">{formatCurrency(cap)}</span>
        </div>
      )}
      {minViews != null && minViews > 0 && (
        <div className="pay-row" style={{ flexWrap: 'wrap' }}>
          <span className="pr-l" style={{ minWidth: 0 }}>{t('Visningar krävs för utbetalning')}</span>
          <span className="pr-v">{formatNumber(minViews)}+</span>
        </div>
      )}
    </div>
  );
}

/** Interactive "what would I earn" slider. */
export function PayoutEstimator({ model, rules, defaultViews = 25_000 }: {
  model: string;
  rules: PayoutRule[];
  defaultViews?: number;
}) {
  const [views, setViews] = useState(defaultViews);
  const amount = estimatePayout(model, rules, views);
  return (
    <div className="pay-est">
      <div className="pe-t">{t('Räkna på din ersättning')}</div>
      <div className="pe-row" style={{ flexWrap: 'wrap' }}>
        <span className="pe-views">{formatNumber(views)} {t('visningar')}</span>
        <span className="pe-amt">≈ {formatCurrency(amount)}</span>
      </div>
      <input
        type="range" min={1000} max={500_000} step={1000} value={views}
        onChange={(e) => setViews(Number(e.target.value))}
        aria-label={t('Antal visningar')}
        style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}
      />
      <div className="auth-hint">{t('Uppskattning — den faktiska ersättningen beräknas på verifierade visningar.')}</div>
    </div>
  );
}
