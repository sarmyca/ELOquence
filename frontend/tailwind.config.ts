import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#111113',
          primary: '#171719',
          secondary: '#1d1d21',
          tertiary: '#25252a',
          elevated: '#2e2e35',
        },
        text: {
          primary: '#ededf0',
          secondary: '#9898a0',
          tertiary: '#5c5c66',
          ghost: '#3c3c44',
        },
        tile: {
          correct: '#538d4e',
          present: '#b59f3b',
          absent: '#3a3a3c',
          empty: '#1d1d21',
        },
        w: {
          green: '#538d4e',
          'green-light': '#6aaa64',
          'green-bright': '#7ec878',
          yellow: '#b59f3b',
          'yellow-light': '#c9b458',
          gray: '#3a3a3c',
        },
        classification: {
          brilliant: '#1565c0',
          best: '#538d4e',
          good: '#6aaa64',
          okay: '#2e9688',
          inaccuracy: '#b59f3b',
          mistake: '#e67e22',
          blunder: '#e74c3c',
          miss: '#9c27b0',
          forced: '#565758',
        },
        tier: {
          novice: '#818384',
          veteran: '#b59f3b',
          master: '#6aaa64',
          grandmaster: '#1565c0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        'card-lg': '16px',
      },
      boxShadow: {
        'glow-green': '0 0 24px rgba(83,141,78,0.2), 0 0 80px rgba(83,141,78,0.06)',
        'glow-green-lg': '0 0 30px rgba(83,141,78,0.3), 0 0 100px rgba(83,141,78,0.08)',
        'glow-yellow': '0 0 24px rgba(181,159,59,0.2), 0 0 80px rgba(181,159,59,0.06)',
        'card': '0 1px 4px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.4)',
        'elevated': '0 8px 32px rgba(0,0,0,0.5)',
        'modal': '0 24px 64px rgba(0,0,0,0.7)',
      },
      animation: {
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
