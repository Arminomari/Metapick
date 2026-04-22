import { useRef } from 'react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}

/**
 * Smart date input: user types digits, dashes are auto-inserted.
 * Format: YYYY-MM-DD. Outputs ISO date string to onChange.
 */
export function DateInput({ value, onChange, required, disabled, className, style, placeholder = 'ÅÅÅÅ-MM-DD' }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Strip everything that isn't a digit or dash, then rebuild
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '-' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6);
    onChange(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow backspace to remove trailing dash transparently
    if (e.key === 'Backspace' && value.endsWith('-')) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
      style={style}
      maxLength={10}
    />
  );
}
