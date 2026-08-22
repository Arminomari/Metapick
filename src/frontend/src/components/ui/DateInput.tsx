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
}

/**
 * Native date input: opens the browser/OS calendar picker on click.
 * Value in/out is an ISO date string (YYYY-MM-DD).
 *
 * Native inputs happily accept 5-6 digit years when the user types fast
 * ("202611-11-05") — sanitize() trims the year back to 4 digits, and the
 * default min/max keep the picker inside a sane century.
 */
function sanitize(v: string): string {
  const m = v.match(/^(\d{5,})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1].slice(0, 4)}-${m[2]}-${m[3]}`;
  return v;
}

export function DateInput({ value, onChange, required, disabled, className, style, min, max }: DateInputProps) {
  return (
    <input
      type="date"
      value={sanitize(value)}
      onChange={(e) => onChange(sanitize(e.target.value))}
      onBlur={(e) => { const s = sanitize(e.target.value); if (s !== e.target.value) onChange(s); }}
      required={required}
      disabled={disabled}
      className={className}
      style={{ fontFamily: 'inherit', ...style }}
      min={min ?? '1900-01-01'}
      max={max ?? '2099-12-31'}
    />
  );
}
