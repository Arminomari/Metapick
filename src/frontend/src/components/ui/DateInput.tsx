import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { t } from '@/lib/i18n';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  min?: string;
  max?: string;
  id?: string;
}

/**
 * App-styled date picker. Same contract as the old native input (ISO
 * YYYY-MM-DD in and out, min/max), but a month grid that looks like the rest
 * of the app on every browser and stays reachable with a thumb.
 */
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const DAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (v: string): Date | null => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null; };
const fmt = (v: string) => { const d = parse(v); return d ? `${d.getDate()} ${t(MONTHS[d.getMonth()])} ${d.getFullYear()}` : ''; };

export function DateInput({ value, onChange, required, disabled, className, style, placeholder, min, max, id }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [view, setView] = useState(() => selected ?? parse(max ?? '') ?? new Date());
  const wrap = useRef<HTMLDivElement>(null);
  const lo = parse(min ?? '1900-01-01')!;
  const hi = parse(max ?? '2099-12-31')!;

  useEffect(() => { if (selected) setView(selected); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];
  const inRange = (d: Date) => d >= lo && d <= hi;
  const today = iso(new Date());
  const canPrev = new Date(view.getFullYear(), view.getMonth(), 1) > new Date(lo.getFullYear(), lo.getMonth(), 1);
  const canNext = new Date(view.getFullYear(), view.getMonth() + 1, 1) <= hi;
  const years = Array.from({ length: hi.getFullYear() - lo.getFullYear() + 1 }, (_, i) => lo.getFullYear() + i);

  return (
    <div ref={wrap} className="ds-datepicker" style={style}>
      <button
        type="button" id={id} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
        className={`ds-datepicker-btn ${className ?? ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? '' : 'ds-muted'}>{value ? fmt(value) : (placeholder ?? t('Välj datum'))}</span>
        <Calendar size={16} aria-hidden />
      </button>
      {required && <input tabIndex={-1} aria-hidden style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} value={value} required onChange={() => undefined} />}
      {open && <div className="ds-datepicker-backdrop" onClick={() => setOpen(false)} aria-hidden />}
      {open && (
        <div className="ds-datepicker-pop" role="dialog" aria-label={t('Välj datum')}>
          <div className="ds-datepicker-head">
            <button type="button" className="ds-iconbtn" disabled={!canPrev} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label={t('Föregående månad')}><ChevronLeft size={18} /></button>
            <span className="ds-datepicker-title">
              <select aria-label={t('Månad')} value={view.getMonth()} onChange={(e) => setView(new Date(view.getFullYear(), Number(e.target.value), 1))}>{MONTHS.map((m, i) => <option key={m} value={i}>{t(m)}</option>)}</select>
              <select aria-label={t('År')} value={view.getFullYear()} onChange={(e) => setView(new Date(Number(e.target.value), view.getMonth(), 1))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
            </span>
            <button type="button" className="ds-iconbtn" disabled={!canNext} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label={t('Nästa månad')}><ChevronRight size={18} /></button>
          </div>
          <div className="ds-datepicker-grid" role="grid">
            {DAYS.map((d, i) => <span key={i} className="ds-datepicker-dow" aria-hidden>{d}</span>)}
            {cells.map((d, i) => d ? (
              <button
                key={i} type="button" role="gridcell"
                className={`ds-datepicker-day${iso(d) === value ? ' on' : ''}${iso(d) === today ? ' today' : ''}`}
                disabled={!inRange(d)}
                aria-selected={iso(d) === value}
                onClick={() => { onChange(iso(d)); setOpen(false); }}
              >{d.getDate()}</button>
            ) : <span key={i} />)}
          </div>
          {value && <button type="button" className="ds-datepicker-clear" onClick={() => { onChange(''); setOpen(false); }}>{t('Rensa')}</button>}
        </div>
      )}
    </div>
  );
}
