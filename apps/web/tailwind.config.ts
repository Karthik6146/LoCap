import type { Config } from 'tailwindcss';

/** LoCap tokens. Values live in app/globals.css; graphite chrome, one mint accent. */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        surface3: 'var(--surface3)',
        border: 'var(--border)',
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        muted: 'var(--muted)',
        // Error text toned to sit inside the palette.
        red: { 300: '#ff9b95', 400: '#f2716c' },
        // Neutral graphite ramp so every text-gray-* lands on one of three text roles.
        gray: {
          50: '#fafafa',
          100: '#ededef',
          200: '#dcdce0',
          300: '#c2c2c8',
          400: '#a1a1a8',
          500: '#8a8a91',
          600: '#5f5f66',
          700: '#3a3a3f',
          800: '#29292d',
          900: '#1f1f22',
          950: '#111113',
        },
      },
      borderRadius: {
        xl: '0.625rem',
        '2xl': '1rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
