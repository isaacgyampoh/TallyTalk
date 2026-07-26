/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brief: predominantly black-on-white with a #6600FF accent.
        paper: '#FFFFFF',
        ink: {
          DEFAULT: '#111114', // primary text
          soft: '#4B4B55', // secondary text
          faint: '#8A8A96', // tertiary / meta
        },
        line: '#ECECF1', // hairline dividers / borders
        wash: '#F6F5FA', // subtle surface fill
        violet: {
          DEFAULT: '#6600FF', // the accent — actions, "owed to me", the wand
          ink: '#4700B3', // pressed / text-on-tint
          tint: '#F1EAFF', // soft violet surface
          glow: '#8A3BFF', // wand glitter highlight
        },
        // accountability semantics
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
        'poke-lift': {
          '0%': { transform: 'translateY(0)', background: '#FFFFFF' },
          '30%': { transform: 'translateY(-4px)', background: '#F1EAFF' },
          '100%': { transform: 'translateY(0)', background: '#FFFFFF' },
        },
      },
      animation: {
        wand: 'wand-glitter 1.4s ease-in-out infinite',
        'rise-in': 'rise-in 0.28s ease-out both',
        poke: 'poke-lift 0.9s ease-out',
      },
    },
  },
  plugins: [],
}
