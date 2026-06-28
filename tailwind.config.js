/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Orbitron', 'ui-sans-serif', 'system-ui'],
        body: ['Rajdhani', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        f1: {
          red: '#e10600',
          dark: '#0a0a0f',
          panel: '#13131a',
          edge: '#1f1f2b',
          ink: '#e7e7ef',
          mute: '#9aa0b4',
        },
        flag: {
          yellow: '#ffd000',
          red: '#ff2233',
          green: '#27e07a',
          blue: '#2f7bff',
        },
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(225,6,0,0.4), 0 0 24px rgba(225,6,0,0.25)',
        glass: '0 8px 40px rgba(0,0,0,0.45)',
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scStripes: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '56px 0' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 1.4s ease-in-out infinite',
        slideUp: 'slideUp 0.25s ease-out',
        scStripes: 'scStripes 0.8s linear infinite',
      },
    },
  },
  plugins: [],
}
