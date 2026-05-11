import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     'var(--bg-base)',
          elevated: 'var(--bg-elevated)',
          muted:    'var(--bg-muted)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          ghost:     'var(--text-ghost)',
        },
        tile: {
          correct: 'var(--tile-correct)',
          present: 'var(--tile-present)',
          absent:  'var(--tile-absent)',
          empty:   'var(--tile-empty-bg)',
        },
        border: {
          subtle:  'var(--border-subtle)',
          default: 'var(--border-default)',
          strong:  'var(--border-strong)',
        },
        tier: {
          novice:      '#818384',
          veteran:     '#b59f3b',
          master:      '#6aaa64',
          grandmaster: '#1565c0',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card:     '12px',
        'card-lg': '16px',
        tile:     '4px',
        key:      '6px',
        pill:     '9999px',
      },
      transitionDuration: {
        fast: '120ms',
        med:  '180ms',
        slow: '260ms',
      },
      boxShadow: {
        card:       '0 1px 4px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.12)',
        elevated:   '0 8px 32px rgba(0,0,0,0.1)',
        modal:      '0 24px 64px rgba(0,0,0,0.15)',
      },
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
