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
 * Value in/out is an ISO date string (YYYY-MM-DD), same contract as before.
 */
export function DateInput({ value, onChange, required, disabled, className, style, min, max }: DateInputProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className={className}
      style={{ fontFamily: 'inherit', ...style }}
      min={min}
      max={max}
    />
  );
}
