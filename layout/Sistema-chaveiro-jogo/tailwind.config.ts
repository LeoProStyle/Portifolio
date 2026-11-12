import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: {
        // Same literal as WIDE_MEDIA_QUERY (components/useWideScreen.ts) and the app/globals.css media block.
        wide: { raw: '(min-width: 1024px) and (pointer: fine)' }
      },
      // Home page identity: brass (key ring / arcade token) on ink, NFC cyan as the signal color.
      colors: {
        ink: { DEFAULT: '#08080D', 900: '#0E0E16', 800: '#15151F', 700: '#1E1E2B' },
        brass: { DEFAULT: '#FFC24B', 300: '#FFD889', 600: '#E0A22A' },
        signal: '#6EE7F9'
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif']
      },
      keyframes: {
        swing: {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' }
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(4%, -6%, 0) scale(1.12)' }
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' }
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        progress: {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' }
        },
        pulsering: {
          '0%': { transform: 'scale(0.6)', opacity: '0.8' },
          '100%': { transform: 'scale(1.8)', opacity: '0' }
        }
      },
      animation: {
        swing: 'swing 5s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        rise: 'rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        pulsering: 'pulsering 2.4s ease-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config;
