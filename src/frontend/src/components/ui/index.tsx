import React from 'react';
import { cn, getStatusColor } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────
   Editorial UI primitives.
   API and prop names preserved verbatim — only visual language
   changes. All variants/sizes that pages already use still work.
   ───────────────────────────────────────────────────────────── */

// ── StatusBadge ────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.72rem] font-medium tracking-wide',
        getStatusColor(status),
      )}
    >
      {status}
    </span>
  );
}

// ── EmptyState ─────────────────────────────────────────
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--sand))] ring-1 ring-[hsl(var(--border))]"
        aria-hidden
      >
        <svg className="h-7 w-7 text-[hsl(var(--muted-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M4 7h16M4 12h10M4 17h7" />
        </svg>
      </div>
      <h3 className="font-display text-2xl">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground col-prose mx-auto">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ── LoadingSpinner ─────────────────────────────────────
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-10', className)}>
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full border border-[hsl(var(--border))]" />
        <div className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-[hsl(var(--primary))]" />
      </div>
    </div>
  );
}

// ── Card ───────────────────────────────────────────────
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative rounded-[20px] border border-[hsl(var(--border))] bg-card text-card-foreground p-6',
        'shadow-soft transition-shadow duration-500 ease-editorial',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-[20px]',
        'before:bg-gradient-to-b before:from-[hsl(var(--ivory)/0.6)] before:to-transparent before:opacity-70',
        '[&>*]:relative',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────
export function StatCard({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string | number;
  subValue?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[18px] border border-[hsl(var(--border))] bg-paper p-5 transition-all duration-500 ease-editorial hover:border-[hsl(var(--border-strong))] hover:shadow-soft">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-display text-[2rem] leading-none tracking-tight">{value}</p>
      {subValue && <p className="mt-2 text-xs text-muted-foreground">{subValue}</p>}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[hsl(var(--primary)/0.06)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
    </div>
  );
}

// ── Button ─────────────────────────────────────────────
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  onClick,
  type = 'button',
  className,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const base =
    'pill select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  const variants: Record<string, string> = {
    primary:
      'bg-primary text-primary-foreground shadow-soft hover:shadow-lift hover:bg-[hsl(var(--primary)/0.92)]',
    secondary:
      'bg-secondary text-secondary-foreground border border-[hsl(var(--border))] hover:border-[hsl(var(--border-strong))] hover:bg-[hsl(var(--sand))]',
    destructive:
      'bg-destructive text-destructive-foreground hover:bg-[hsl(var(--destructive)/0.9)] shadow-soft',
    ghost:
      'bg-transparent text-foreground hover:bg-[hsl(var(--sand))] border border-transparent hover:border-[hsl(var(--border))]',
  };

  const sizes: Record<string, string> = {
    sm: 'h-8  px-4 text-[0.78rem]',
    md: 'h-10 px-5 text-[0.88rem]',
    lg: 'h-12 px-7 text-[0.95rem]',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </button>
  );
}

// ── DataTable ──────────────────────────────────────────
export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
}: {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={cn(
                  'border-b border-[hsl(var(--border))] px-4 py-3 text-left font-medium eyebrow !tracking-[0.18em]',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-b border-[hsl(var(--border)/0.6)] transition-colors duration-300 ease-soft',
                onRowClick && 'cursor-pointer hover:bg-[hsl(var(--sand)/0.45)]',
              )}
            >
              {columns.map((col, i) => (
                <td key={i} className={cn('px-4 py-4 align-middle', col.className)}>
                  {typeof col.accessor === 'function'
                    ? col.accessor(row)
                    : String(row[col.accessor] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────
export function Pagination({
  page,
  totalCount,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="mt-2 flex items-center justify-between border-t border-[hsl(var(--border))] px-2 pt-5">
      <p className="text-xs text-muted-foreground">
        Visar <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}</span>–
        <span className="font-medium text-foreground">{Math.min(page * pageSize, totalCount)}</span>
        {' '}av <span className="font-medium text-foreground">{totalCount}</span>
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ← Föregående
        </Button>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Nästa →
        </Button>
      </div>
    </div>
  );
}
