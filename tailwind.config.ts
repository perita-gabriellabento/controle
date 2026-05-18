import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:           'rgb(var(--color-bg)      / <alpha-value>)',
        surface:      'rgb(var(--color-surface)  / <alpha-value>)',
        'surface-2':  'rgb(var(--color-surface2) / <alpha-value>)',
        'surface-3':  'rgb(var(--color-surface3) / <alpha-value>)',
        gold:         'rgb(var(--color-gold)     / <alpha-value>)',
        'gold-light': 'rgb(var(--color-goldlt)   / <alpha-value>)',
        text:         'rgb(var(--color-text)     / <alpha-value>)',
        muted:        'rgb(var(--color-text)     / <alpha-value>)',
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        montserrat: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        dialog: 'var(--shadow-dialog, 0 24px 64px rgba(0,0,0,0.35))',
      },
      borderColor: {
        DEFAULT: 'rgba(212,175,55,0.15)',
      },
    },
  },
  plugins: [],
}

export default config
