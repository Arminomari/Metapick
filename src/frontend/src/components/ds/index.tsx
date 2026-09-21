/**
 * VYRLE design system components (Phase 3).
 *
 * Thin, typed wrappers over the classes in `styles/ds.css`. No business
 * logic, no data fetching. Every component works at 375 px first.
 */
import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CountUp, staggerContainer, staggerItem } from '@/components/motion';
import { ChevronRight, X } from 'lucide-react';
import { useTitle } from '@/lib/title';
import { statusLabel } from '@/lib/i18n';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* ── Button ───────────────────────────────────────────────── */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  full?: boolean;
  danger?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  to?: string;
  children?: React.ReactNode;
}
export function Button({ variant = 'primary', size = 'md', full, danger, loading, icon, to, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  const cls = cx('ds-btn', `ds-btn--${variant}`, size === 'sm' && 'ds-btn--sm', full && 'ds-btn--full', danger && 'ds-btn--danger', className);
  const inner = <>{icon}{children != null && <span>{loading ? '…' : children}</span>}</>;
  if (to) return <Link to={to} className={cls} aria-disabled={disabled || loading || undefined}>{inner}</Link>;
  return <button type={type} className={cls} disabled={disabled || loading} {...rest}>{inner}</button>;
}

export function IconButton({ label, boxed, badge, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; boxed?: boolean; badge?: number }) {
  return (
    <button type="button" aria-label={label} className={cx('ds-iconbtn', boxed && 'ds-iconbtn--boxed', className)} {...rest}>
      {children}
      {badge ? <span className="ds-count" style={{ position: 'absolute', top: 4, right: 4 }}>{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );
}

/** Sticky container for the one primary action of a screen, kept in thumb reach. */
export function StickyAction({ children }: { children: React.ReactNode }) {
  return <div className="ds-sticky-action">{children}</div>;
}

/* ── Card ─────────────────────────────────────────────────── */
export function Card({ title, action, flush, elevated, className, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { title?: React.ReactNode; action?: React.ReactNode; flush?: boolean; elevated?: boolean }) {
  return (
    <div className={cx('ds-card', flush && 'ds-card--flush', elevated && 'ds-card--elevated', rest.onClick && 'ds-card--lift', className)} {...rest}>
      {(title || action) && <div className="ds-card-head"><h3 className="ds-heading">{title}</h3>{action}</div>}
      {children}
    </div>
  );
}

/* ── Page scaffolding ─────────────────────────────────────── */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cx('ds-page', className)}>{children}</main>;
}
export function PageHead({ title, back, actions }: { title: React.ReactNode; back?: { to?: string; onClick?: () => void; label?: string }; actions?: React.ReactNode }) {
  useTitle(typeof title === 'string' ? title : null);
  return (
    <div className="ds-page-head">
      {back && (back.to
        ? <Link to={back.to} className="ds-iconbtn" aria-label={back.label ?? 'Tillbaka'}><ChevronRight style={{ transform: 'rotate(180deg)' }} /></Link>
        : <IconButton label={back.label ?? 'Tillbaka'} onClick={back.onClick}><ChevronRight style={{ transform: 'rotate(180deg)' }} /></IconButton>)}
      <h1 className="ds-title">{title}</h1>
      {actions}
    </div>
  );
}
export function Section({ title, action, children }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ds-section">
      {(title || action) && <div className="ds-section-head"><h2 className="ds-heading">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

/* ── StatTile ─────────────────────────────────────────────── */
/**
 * A number tile. Pass `count` + `format` for a SYSTEM_COMPUTED number and it
 * counts up on first paint (plain render under reduced motion); `value` is for
 * already-formatted or non-numeric content.
 */
export function StatTile({ label, value, count, format, hint, accent, plain }: { label: string; value?: React.ReactNode; count?: number; format?: (n: number) => string; hint?: React.ReactNode; accent?: boolean; plain?: boolean }) {
  return (
    <motion.div className={cx('ds-stat', accent && 'ds-stat--accent', plain && 'ds-stat--plain')} variants={staggerItem}>
      <div className="ds-stat-value ds-num">{count != null ? <CountUp value={count} format={format ?? String} /> : value}</div>
      <div className="ds-stat-label">{label}</div>
      {hint && <div className="ds-stat-hint">{hint}</div>}
    </motion.div>
  );
}
export function StatRow({ children, cols }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return <motion.div className={cx('ds-stat-row', cols === 3 && 'ds-stat-row--3', cols === 4 && 'ds-stat-row--4')} variants={staggerContainer} initial="hidden" animate="show">{children}</motion.div>;
}

/* ── Avatar ───────────────────────────────────────────────── */
export function Avatar({ src, name, size = 'md', rounded, gradient }: { src?: string | null; name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; rounded?: boolean; gradient?: boolean }) {
  const initial = (name?.trim()[0] || '?').toUpperCase();
  return (
    <span className={cx('ds-avatar', `ds-avatar--${size}`, rounded && 'ds-avatar--rounded', gradient && !src && 'ds-avatar--gradient')} aria-hidden>
      {src ? <img src={src} alt="" /> : initial}
    </span>
  );
}

/* ── Badge / Count / Chip ─────────────────────────────────── */
export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'accent';
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={cx('ds-badge', tone !== 'neutral' && `ds-badge--${tone}`)}>{children}</span>;
}
const STATUS_TONE: Record<string, BadgeTone> = {
  Active: 'ok', Approved: 'ok', Verified: 'ok', Completed: 'ok', Paid: 'ok', ReadyForManualPayment: 'ok', GoalReached: 'ok', Matched: 'ok', Accepted: 'ok', Published: 'ok',
  Pending: 'warn', PendingApproval: 'warn', PendingReview: 'warn', PendingVerification: 'warn', UnderReview: 'warn', ManualReview: 'warn', AwaitingThreshold: 'warn', Processing: 'warn', Requested: 'warn', Submitted: 'warn', Preliminary: 'warn', InProgress: 'warn', Sent: 'warn', Viewed: 'warn', Invited: 'warn', RevisionRequested: 'warn',
  Rejected: 'bad', Failed: 'bad', Cancelled: 'bad', Suspended: 'bad', Expired: 'bad', Flagged: 'bad', Disqualified: 'bad', Declined: 'bad', Deactivated: 'bad', Disputed: 'bad',
};
export const statusTone = (status: string): BadgeTone => STATUS_TONE[status] ?? 'neutral';
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? statusLabel(status)}</Badge>;
}
export function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span className="ds-count">{n > 99 ? '99+' : n}</span>;
}
export function Chip({ selected, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" className="ds-chip" aria-pressed={!!selected} {...rest}>{children}</button>;
}
export function Chips({ children }: { children: React.ReactNode }) {
  return <div className="ds-chips" role="group">{children}</div>;
}

/* ── ListRow ──────────────────────────────────────────────── */
export interface ListRowProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  wrapSubtitle?: boolean;
  value?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  to?: string;
  onClick?: () => void;
  className?: string;
}
const MotionLink = motion(Link);
export function ListRow({ leading, title, badge, subtitle, wrapSubtitle, value, trailing, chevron, to, onClick, className }: ListRowProps) {
  const interactive = Boolean(to || onClick);
  const cls = cx('ds-listrow', interactive && 'ds-listrow--interactive', className);
  const body = (
    <>
      {leading}
      <div className="ds-listrow-main">
        <div className="ds-listrow-title"><span>{title}</span>{badge}</div>
        {subtitle && <div className={cx('ds-listrow-sub', wrapSubtitle && 'ds-listrow-sub--wrap')}>{subtitle}</div>}
      </div>
      {(value || trailing || (chevron ?? interactive)) && (
        <div className="ds-listrow-trail">
          {value != null && <span className="ds-listrow-value ds-num">{value}</span>}
          {trailing}
          {(chevron ?? interactive) && <ChevronRight className="ds-listrow-chevron" aria-hidden />}
        </div>
      )}
    </>
  );
  if (to) return <MotionLink to={to} className={cls} variants={staggerItem}>{body}</MotionLink>;
  if (onClick) return <motion.button type="button" className={cls} onClick={onClick} variants={staggerItem}>{body}</motion.button>;
  return <motion.div className={cls} variants={staggerItem}>{body}</motion.div>;
}
export function List({ children, plain, className }: { children: React.ReactNode; plain?: boolean; className?: string }) {
  return <motion.div className={cx('ds-list', plain && 'ds-list--plain', className)} variants={staggerContainer} initial="hidden" animate="show">{children}</motion.div>;
}

/* ── SegmentedControl ─────────────────────────────────────── */
export interface Segment<K extends string> { key: K; label: string; count?: number }
export function SegmentedControl<K extends string>({ segments, value, onChange, label }: { segments: Segment<K>[]; value: K; onChange: (k: K) => void; label?: string }) {
  return (
    <div className={cx('ds-seg', segments.length >= 4 && 'ds-seg--dense')} role="tablist" aria-label={label}>
      {segments.map((s) => (
        <button key={s.key} type="button" role="tab" aria-selected={s.key === value} className="ds-seg-item" onClick={() => onChange(s.key)}>
          {s.label}{s.count ? <Count n={s.count} /> : null}
        </button>
      ))}
    </div>
  );
}

/* ── Field ────────────────────────────────────────────────── */
export function Field({ label, hint, error, children, id }: { label: string; hint?: React.ReactNode; error?: React.ReactNode; children: React.ReactElement; id?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  const child = React.cloneElement(children, { id: inputId, className: cx('ds-input', children.props.className), 'aria-invalid': error ? true : undefined });
  return (
    <div className={cx('ds-field', error ? 'ds-field--error' : undefined)}>
      <label className="ds-field-label" htmlFor={inputId}>{label}</label>
      {child}
      {error ? <div className="ds-field-error" role="alert">{error}</div> : hint ? <div className="ds-field-hint">{hint}</div> : null}
    </div>
  );
}
export function Checkbox({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return <label className="ds-check"><input type="checkbox" {...rest} /><span>{label}</span></label>;
}

/* ── Meter ────────────────────────────────────────────────── */
export function Meter({ value, max, tone, left, right }: { value: number; max: number; tone?: 'accent' | 'ok' | 'bad'; left?: React.ReactNode; right?: React.ReactNode }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx('ds-meter', tone && tone !== 'accent' && `ds-meter--${tone}`)} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="ds-meter-track"><div className="ds-meter-fill" style={{ width: `${pct}%` }} /></div>
      {(left || right) && <div className="ds-meter-labels"><span>{left}</span><span>{right}</span></div>}
    </div>
  );
}

/* ── EmptyState ───────────────────────────────────────────── */
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="ds-empty">
      {icon && <div className="ds-empty-icon">{icon}</div>}
      {title && <h3 className="ds-heading">{title}</h3>}
      {description && <p className="ds-body">{description}</p>}
      {action}
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────── */
export function Skeleton({ w = '100%', h = 14, r, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <span className="ds-skel" aria-hidden style={{ width: w, height: h, borderRadius: r, ...style }} />;
}
export function SkeletonRow() {
  return (
    <div className="ds-listrow" aria-busy="true">
      <Skeleton w={44} h={44} r={999} />
      <div className="ds-listrow-main"><Skeleton w="60%" h={14} /><Skeleton w="40%" h={12} /></div>
      <Skeleton w={48} h={14} />
    </div>
  );
}
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return <div className="ds-list" aria-busy="true">{Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} />)}</div>;
}
export function SkeletonStats({ n = 3 }: { n?: number }) {
  return <div className="ds-stat-row" aria-busy="true">{Array.from({ length: n }, (_, i) => <div key={i} className="ds-stat"><Skeleton w="70%" h={24} /><Skeleton w="50%" h={12} /></div>)}</div>;
}

/* ── BottomSheet ──────────────────────────────────────────── */
export function BottomSheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="ds-root" style={{ minHeight: 0, background: 'none' }}>
      <div className="ds-sheet-backdrop" onClick={onClose} aria-hidden />
      <div className="ds-sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="ds-sheet-grip" aria-hidden />
        <div className="ds-sheet-head">
          <h2 className="ds-heading">{title}</h2>
          <IconButton label="Stäng" onClick={onClose}><X /></IconButton>
        </div>
        <div className="ds-sheet-body">{children}</div>
        {footer && <div className="ds-sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
/** A sheet whose body is a menu of rows (the "…" and "+" pattern). */
export function SheetMenu({ children }: { children: React.ReactNode }) {
  return <div className="ds-sheet-menu">{children}</div>;
}

/* ── TabBar ───────────────────────────────────────────────── */
export interface TabItem { key: string; label: string; icon: React.ReactNode; to: string; badge?: number; dot?: boolean }
export function TabBar({ items, current, action, brand }: { items: TabItem[]; current: string; action?: { label: string; icon: React.ReactNode; onClick: () => void }; brand?: React.ReactNode }) {
  const mid = Math.ceil(items.length / 2);
  const tab = (t: TabItem) => (
    <Link key={t.key} to={t.to} className="ds-tab" aria-current={t.key === current ? 'page' : undefined}>
      {t.icon}<span>{t.label}</span>
      {t.badge ? <Count n={t.badge} /> : t.dot ? <span className="ds-dot" /> : null}
    </Link>
  );
  return (
    <nav className="ds-tabbar" aria-label="Huvudnavigering">
      {brand && <div className="ds-sidebar-brand">{brand}</div>}
      {items.slice(0, mid).map(tab)}
      {action && (
        <button type="button" className="ds-tab ds-tab--action" onClick={action.onClick} aria-label={action.label}>
          <span className="ds-tab-plus">{action.icon}<span>{action.label}</span></span>
        </button>
      )}
      {items.slice(mid).map(tab)}
    </nav>
  );
}
