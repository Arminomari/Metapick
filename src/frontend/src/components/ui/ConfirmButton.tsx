import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { t } from '@/lib/i18n';

/**
 * Two-step button for actions that hurt if pressed by accident (reject, pause,
 * remove). The first press arms it for a few seconds and says so; the second
 * press does the thing. Same pattern the campaign and community lists already
 * used inline — one component so every such action behaves alike.
 */
export function ConfirmButton({
  onConfirm, children, confirmLabel, className = 'btn-outline', style, disabled, armedFor = 4000,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  armedFor?: number;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const press = () => {
    if (!armed) {
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), armedFor);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    setArmed(false);
    onConfirm();
  };

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); press(); }}
      aria-live="polite"
      style={{ ...style, ...(armed ? { borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 600 } : {}) }}
    >
      {armed ? (confirmLabel ?? t('Säker? Klicka igen')) : children}
    </button>
  );
}
