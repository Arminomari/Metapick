import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (stars: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };

export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`${sizes[size]} transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} ${
            star <= display ? 'text-yellow-400' : 'text-muted-foreground/30'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
