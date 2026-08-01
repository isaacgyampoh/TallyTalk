/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Themeable neutrals (flip in dark mode via CSS vars in index.css).
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          soft: 'rgb(var(--c-ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--c-ink-faint) / <alpha-value>)',
        },
        line: 'rgb(var(--c-line) / <alpha-value>)',
        wash: 'rgb(var(--c-wash) / <alpha-value>)',
        // Fixed strong-contrast surface (never flips) — chips, bands, toasts.
        carbon: '#111114',
        violet: {
          DEFAULT: '#6600FF',
          ink: 'rgb(var(--c-violet-ink) / <alpha-value>)',
          tint: 'rgb(var(--c-violet-tint) / <alpha-value>)',
          glow: '#8A3BFF',
        },
        overdue: '#E5484D',
        urgent: '#F76808',
        done: '#30A46C',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
        bubble: '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(17,17,20,0.04), 0 6px 24px -12px rgba(17,17,20,0.12)',
        float: '0 8px 30px -8px rgba(102,0,255,0.45)',
      },
      keyframes: {
        'wand-glitter': {
          '0%, 100%': { transform: 'rotate(-8deg) scale(1)', filter: 'drop-shadow(0 0 0 rgba(138,59,255,0))' },
          '50%': { transform: 'rotate(8deg) scale(1.12)', filter: 'drop-shadow(0 0 8px rgba(138,59,255,0.8))' },
        },
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'page-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.995)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'poke-lift': {
          '0%': { transform: 'translateY(0)', background: '#FFFFFF' },
          '30%': { transform: 'translateY(-4px)', background: '#F1EAFF' },
          '100%': { transform: 'translateY(0)', background: '#FFFFFF' },
        },
      },
      animation: {
        wand: 'wand-glitter 1.4s ease-in-out infinite',
        'rise-in': 'rise-in 0.28s ease-out both',
        'page-in': 'page-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        poke: 'poke-lift 0.9s ease-out',
      },
    },
  },
  plugins: [],
}
