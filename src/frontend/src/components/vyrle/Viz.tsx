import type { ReactNode } from 'react';

/* ============================================================
   VYRLE visualization toolkit — blush donuts, area charts,
   score rings and bars used across Analytics / Earnings /
   Portfolio / PR Hub. Pure SVG, no deps. Each chart needs a
   unique `id` so its gradient defs don't collide.
   ============================================================ */

export const BLUSH = ['#F1A88F', '#cdb8f2', '#a9dcc0', '#F2C58A', '#9c7de0', '#5fb98a', '#e0a04e', '#d2d2d7'];

/* ---- multi-segment donut ---- */
export function Donut({ size = 170, stroke = 10, segments, children }: {
  size?: number; stroke?: number; segments: { value: number; color: string }[]; children?: ReactNode;
}) {
  const R = 50, C = 2 * Math.PI * R;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <div className="vrep-donut" style={{ width: size, height: size, margin: '0 auto', position: 'relative' }}>
      <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(183,188,200,.22)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * C;
          const el = (
            <circle key={i} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeLinecap="round" strokeDasharray={`${Math.max(dash - 1.5, 0)} ${C}`} strokeDashoffset={-offset}
              transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray .6s cubic-bezier(.16,1,.3,1)' }} />
          );
          offset += dash;
          return el;
        })}
      </svg>
      {children && <div className="vrep-center">{children}</div>}
    </div>
  );
}

/* ---- smooth area chart ---- */
function smooth(pts: readonly (readonly [number, number])[]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[0], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function AreaChart({ id, values, labels, fmtY = (n) => String(Math.round(n)), height = 280 }: {
  id: string; values: number[]; labels: string[]; fmtY?: (n: number) => string; height?: number;
}) {
  const W = 900, H = 300, top = 16, bot = 16;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length === 1 ? W / 2 : (i / (values.length - 1)) * W, top + (1 - v / max) * (H - top - bot)] as const);
  const line = smooth(pts);
  const area = pts.length ? `${line} L ${W},${H} L 0,${H} Z` : '';
  const last = pts[pts.length - 1];
  return (
    <div className="vchart" style={{ height }}>
      <div className="vchart-y">
        {[1, .75, .5, .25, 0].map((f) => <span key={f}>{fmtY(max * f)}</span>)}
      </div>
      <div className="vchart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="vchart-svg">
          <defs>
            <linearGradient id={`${id}Fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F1A88F" stopOpacity=".42" /><stop offset="55%" stopColor="#F1A88F" stopOpacity=".12" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></linearGradient>
            <linearGradient id={`${id}Line`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FFD0BC" /><stop offset="55%" stopColor="#F1A88F" /><stop offset="100%" stopColor="#E68A6E" /></linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" y1={top + f * (H - top - bot)} x2={W} y2={top + f * (H - top - bot)} stroke="#F5EDE4" strokeWidth="1" />)}
          {area && <path d={area} fill={`url(#${id}Fill)`} />}
          {line && <path d={line} fill="none" stroke={`url(#${id}Line)`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />}
          {last && <circle cx={last[0]} cy={last[1]} r="5.5" fill="#fff" stroke="#F1A88F" strokeWidth="3" />}
        </svg>
        <div className="vchart-x">{labels.map((l, i) => <span key={i} style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</span>)}</div>
      </div>
    </div>
  );
}

/* ---- score ring (single value 0..100) ---- */
export function Ring({ pct, size = 46, label }: { pct: number; size?: number; label?: ReactNode }) {
  const r = 19, C = 2 * Math.PI * r, dash = (Math.max(0, Math.min(100, pct)) / 100) * C;
  return (
    <span className="vdisc-score" style={{ width: size, height: size, flex: `0 0 ${size}px` }}>
      <svg viewBox="0 0 44 44" className="vdisc-ring" style={{ width: size, height: size }}>
        <circle className="vdisc-track" cx="22" cy="22" r={r} />
        <circle cx="22" cy="22" r={r} fill="none" stroke="url(#setoBlush)" strokeWidth="3.4" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} />
      </svg>
      <span className="vdisc-num">{label ?? pct}</span>
    </span>
  );
}

/* ---- horizontal mini bars ---- */
export function MiniBars({ rows }: { rows: { label: string; pct: number; value: string }[] }) {
  return (
    <>
      {rows.map((r, i) => (
        <div className="minibar" key={i}>
          <span className="nm">{r.label}</span>
          <span className="track"><span style={{ width: `${Math.max(2, Math.min(100, r.pct))}%` }} /></span>
          <span className="pct">{r.value}</span>
        </div>
      ))}
    </>
  );
}

/* shared SVG gradient defs (setoBlush) for rings — mount once per page */
export function VizDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <linearGradient id="setoBlush" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFC2A6" /><stop offset="100%" stopColor="#F1A88F" /></linearGradient>
    </defs></svg>
  );
}
