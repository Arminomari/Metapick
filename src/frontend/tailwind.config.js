/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border:          'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        input:           'hsl(var(--input))',
        ring:            'hsl(var(--ring))',
        background:      'hsl(var(--background))',
        foreground:      'hsl(var(--foreground))',
        paper:           'hsl(var(--paper))',
        ivory:           'hsl(var(--ivory))',
        sand:            'hsl(var(--sand))',
        graphite:        'hsl(var(--graphite))',
        primary:     { DEFAULT: 'hsl(var(--primary))',     foreground: 'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT: 'hsl(var(--secondary))',   foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))',       foreground: 'hsl(var(--muted-foreground))' },
        accent:      { DEFAULT: 'hsl(var(--accent))',      foreground: 'hsl(var(--accent-foreground))' },
        card:        { DEFAULT: 'hsl(var(--card))',        foreground: 'hsl(var(--card-foreground))' },
        success:     'hsl(var(--success))',
        warning:     'hsl(var(--warning))',
        oxblood:     'hsl(var(--primary))',
      },
      fontFamily: {
        display: ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif:   ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans:    ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['clamp(3.5rem, 9vw, 7.5rem)', { lineHeight: '0.95', letterSpacing: '-0.035em' }],
        'display-xl':  ['clamp(2.75rem, 6vw, 5rem)',  { lineHeight: '1.0',  letterSpacing: '-0.03em'  }],
        'display-lg':  ['clamp(2rem, 4vw, 3.25rem)',  { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'eyebrow':     ['0.72rem',                    { lineHeight: '1',    letterSpacing: '0.22em'   }],
      },
      borderRadius: {
        sm:    '8px',
        md:    '12px',
        lg:    '16px',
        xl:    '20px',
        '2xl': '24px',
      },
      boxShadow: {
        soft:   '0 1px 2px hsl(var(--shadow) / 0.04), 0 8px 24px -12px hsl(var(--shadow) / 0.10)',
        lift:   '0 1px 2px hsl(var(--shadow) / 0.05), 0 14px 36px -16px hsl(var(--shadow) / 0.18)',
        floaty: '0 24px 60px -28px hsl(var(--shadow) / 0.30)',
        inset:  'inset 0 1px 0 hsl(var(--ivory) / 0.6)',
      },
      transitionTimingFunction: {
        'ease-soft':      'cubic-bezier(0.22, 0.61, 0.36, 1)',
        'ease-editorial': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-rise': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'   },
        },
        'soft-pulse': {
          '0%,100%': { opacity: '0.55' },
          '50%':     { opacity: '1'    },
        },
        'marquee': {
          '0%':   { transform: 'translateX(0)'    },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-rise':  'fade-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite',
        'marquee':    'marquee 38s linear infinite',
      },
    },
  },
  plugins: [],
};
