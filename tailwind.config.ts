import type { Config } from 'tailwindcss';

/**
 * iTarang design system.
 *
 * Colour + radius tokens are declared as CSS custom properties in `globals.css`
 * (HSL channel triplets) so a single token set drives both light and dark themes.
 * Everything here maps those tokens onto Tailwind's scale.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem', '2xl': '2.5rem' },
      screens: { '2xl': '1440px' },
    },
    extend: {
      screens: {
        xs: '480px',
      },
      spacing: {
        4.5: '1.125rem',
        18: '4.5rem',
      },
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          50: 'hsl(var(--navy-50) / <alpha-value>)',
          100: 'hsl(var(--navy-100) / <alpha-value>)',
          200: 'hsl(var(--navy-200) / <alpha-value>)',
          300: 'hsl(var(--navy-300) / <alpha-value>)',
          400: 'hsl(var(--navy-400) / <alpha-value>)',
          500: 'hsl(var(--navy-500) / <alpha-value>)',
          600: 'hsl(var(--navy-600) / <alpha-value>)',
          700: 'hsl(var(--navy-700) / <alpha-value>)',
          800: 'hsl(var(--navy-800) / <alpha-value>)',
          900: 'hsl(var(--navy-900) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
          50: 'hsl(var(--amber-50) / <alpha-value>)',
          100: 'hsl(var(--amber-100) / <alpha-value>)',
          200: 'hsl(var(--amber-200) / <alpha-value>)',
          300: 'hsl(var(--amber-300) / <alpha-value>)',
          400: 'hsl(var(--amber-400) / <alpha-value>)',
          500: 'hsl(var(--amber-500) / <alpha-value>)',
          600: 'hsl(var(--amber-600) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
          soft: 'hsl(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
          soft: 'hsl(var(--warning-soft) / <alpha-value>)',
        },
        sale: {
          DEFAULT: 'hsl(var(--sale) / <alpha-value>)',
          foreground: 'hsl(var(--sale-foreground) / <alpha-value>)',
          soft: 'hsl(var(--sale-soft) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        xs: 'calc(var(--radius) - 0.55rem)',
        sm: 'calc(var(--radius) - 0.4rem)',
        md: 'calc(var(--radius) - 0.25rem)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 0.35rem)',
        '2xl': 'calc(var(--radius) + 0.7rem)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Sora', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
      },
      boxShadow: {
        card: '0 1px 2px 0 hsl(var(--navy-900) / 0.04), 0 1px 3px 0 hsl(var(--navy-900) / 0.05)',
        raised:
          '0 2px 4px -2px hsl(var(--navy-900) / 0.06), 0 8px 20px -6px hsl(var(--navy-900) / 0.12)',
        overlay:
          '0 10px 20px -8px hsl(var(--navy-900) / 0.16), 0 24px 48px -12px hsl(var(--navy-900) / 0.22)',
        focus: '0 0 0 3px hsl(var(--ring) / 0.35)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out both',
        'fade-up': 'fade-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slide-in-left 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
