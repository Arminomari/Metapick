import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/* ============================================================
   VYRLE toast system — replaces browser alert()/confirm() with
   on-brand, animated toasts. Mount <ToastProvider> once in the
   shell; call useToast().push('Saved!', 'success').
   ============================================================ */

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; text: string; leaving?: boolean };

const ToastCtx = createContext<{ push: (text: string, kind?: ToastKind) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

const ICONS: Record<ToastKind, ReactNode> = {
  success: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg>,
  error: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></svg>,
  info: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5h.01" /></svg>,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3600);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="vy-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`vy-toast ${t.kind}${t.leaving ? ' leaving' : ''}`}>
            <span className="vy-toast-ic">{ICONS[t.kind]}</span>
            <span className="vy-toast-tx">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── skeleton loaders ── */
export function Skeleton({ h = 14, w = '100%', r = 8, style }: { h?: number; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <span className="vy-skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

/** Full-card skeleton matching the VYRLE card look — drop in while a page loads. */
export function CardSkeleton({ rows = 3, height }: { rows?: number; height?: number }) {
  return (
    <div className="card" style={{ minHeight: height }}>
      <Skeleton h={18} w="34%" style={{ marginBottom: 18 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
          <Skeleton h={42} w={42} r={13} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton h={13} w={`${55 + (i * 13) % 30}%`} />
            <Skeleton h={11} w={`${30 + (i * 7) % 20}%`} />
          </span>
          <Skeleton h={13} w={64} />
        </div>
      ))}
    </div>
  );
}

/** Stat-row skeleton (4 vstat cards). */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="vstat-row">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card vstat">
          <Skeleton h={50} w={50} r={16} style={{ marginBottom: 20 }} />
          <Skeleton h={12} w="46%" style={{ marginBottom: 10 }} />
          <Skeleton h={28} w="62%" />
        </div>
      ))}
    </div>
  );
}

/** Whole-page loading state: stat row + two cards. */
export function PageSkeleton() {
  return (
    <section className="view active">
      <div style={{ marginBottom: 26 }}>
        <Skeleton h={40} w={320} style={{ marginBottom: 12 }} />
        <Skeleton h={14} w={440} />
      </div>
      <StatRowSkeleton />
      <div className="vcsplit" style={{ marginTop: 4 }}>
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
    </section>
  );
}
