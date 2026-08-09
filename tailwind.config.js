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
        card: '24px',
        bubble: '22px',
      },
      boxShadow: {
        card: '0 2px 10px -4px rgba(17,17,20,0.06), 0 16px 40px -20px rgba(60,20,120,0.18)',
        soft: '0 10px 40px -16px rgba(60,20,120,0.20)',
        float: '0 12px 34px -10px rgba(102,0,255,0.42)',
      },
      keyframes: {
        'intro-pop': {
          '0%': { opacity: '0', transform: 'scale(0.55) rotate(-14deg)' },
          '55%': { opacity: '1', transform: 'scale(1.08) rotate(4deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'intro-word': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'intro-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0', visibility: 'hidden' },
        },
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
        'intro-pop': 'intro-pop 0.75s cubic-bezier(0.22, 1, 0.36, 1) both',
        'intro-word': 'intro-word 0.5s ease-out 0.35s both',
        'intro-out': 'intro-out 0.45s ease 1.35s forwards',
        'rise-in': 'rise-in 0.28s ease-out both',
        'page-in': 'page-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        poke: 'poke-lift 0.9s ease-out',
      },
    },
  },
  plugins: [],
}
