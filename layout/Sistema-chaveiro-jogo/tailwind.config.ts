import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: {
        // Same literal as WIDE_MEDIA_QUERY (components/useWideScreen.ts) and the app/globals.css media block.
        wide: { raw: '(min-width: 1024px) and (pointer: fine)' }
      }
    }
  },
  plugins: []
} satisfies Config;
