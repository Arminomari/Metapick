/**
 * The three charts Statistik needs, in neutral greys with the one accent.
 * Pure SVG, no library, every one renders at 343 px wide.
 */
import { Meter } from '@/components/ds';

export const PALETTE = ['var(--ds-accent)', '#5F5F68', '#9A9AA3', '#CFCFD6', '#1F7A4D', '#8A5A00', '#B3261E', '#E6E6EA'];

export function Bars({ rows, tone }: { rows: { label: string; value: number; display: string }[]; tone?: 'accent' | 'ok' | 'bad' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="ds-bars">
      {rows.map((r) => (
        <div key={r.label} className="ds-bar">
          <span className="ds-bar-label">{r.label}</span>
          <span className="ds-bar-value ds-num">{r.display}</span>
          <Meter value={r.value} max={max} tone={tone} />
        </div>
      ))}
    </div>
  );
}

export function LineChart({ values, labels, height = 160, fmt = (n: number) => String(Math.round(n)) }: { values: number[]; labels: string[]; height?: number; fmt?: (n: number) => string }) {
  const W = 600, H = height, padTop = 12, padBot = 6;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length === 1 ? W / 2 : (i / (values.length - 1)) * W, padTop + (1 - v / max) * (H - padTop - padBot)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${W},${H} L0,${H} Z` : '';
  return (
    <div>
      <div className="ds-caption ds-muted" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{fmt(max)}</span><span>0</span></div>
      <svg className="ds-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={padTop + f * (H - padTop - padBot)} y2={padTop + f * (H - padTop - padBot)} stroke="var(--ds-line)" strokeWidth="1" />)}
        <path d={area} fill="var(--ds-accent-soft)" />
        <path d={line} fill="none" stroke="var(--ds-accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke="var(--ds-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="ds-chart-x">{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
    </div>
  );
}

export function Donut({ segments, size = 120, children }: { segments: { value: number; color: string; label?: string }[]; size?: number; children?: React.ReactNode }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 44, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="ds-row" style={{ gap: 16, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: `0 0 ${size}px` }}>
        <svg viewBox="0 0 110 110" width={size} height={size} aria-hidden>
          <circle cx="55" cy="55" r={R} fill="none" stroke="var(--ds-neutral-soft)" strokeWidth="11" />
          {segments.map((s, i) => {
            const dash = (s.value / total) * C;
            const el = <circle key={i} cx="55" cy="55" r={R} fill="none" stroke={s.color} strokeWidth="11" strokeDasharray={`${Math.max(dash - 1, 0)} ${C}`} strokeDashoffset={-offset} transform="rotate(-90 55 55)" />;
            offset += dash;
            return el;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{children}</div>
      </div>
      <div className="ds-legend ds-grow">
        {segments.filter((s) => s.label).map((s, i) => (
          <div key={i} className="ds-legend-item"><span className="ds-legend-swatch" style={{ background: s.color }} /><span>{s.label}</span><span className="ds-num">{Math.round((s.value / total) * 100)} %</span></div>
        ))}
      </div>
    </div>
  );
}
