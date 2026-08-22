import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (stars: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 17, md: 25, lg: 31 };

export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  const px = SIZES[size];

  return (
    <div style={{ display: 'inline-flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            aria-label={`${star} / 5`}
            style={{
              background: 'none', border: 'none', padding: 0, lineHeight: 1,
              fontSize: px, cursor: readonly ? 'default' : 'pointer',
              color: filled ? '#e88c66' : 'rgba(11,15,23,.16)',
              textShadow: filled ? '0 2px 8px rgba(241,168,143,.45)' : 'none',
              transform: !readonly && hovered === star ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform .15s, color .15s',
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
