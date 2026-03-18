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
          base: '#09090b',
          primary: '#0f1012',
          secondary: '#16171a',
          tertiary: '#1e1f23',
          elevated: '#26272c',
        },
        text: {
          primary: '#f0f0f3',
          accent: '#d7dadc',
          secondary: '#9ba1a6',
          tertiary: '#6b7280',
          ghost: '#4b5563',
        },
        tile: {
          correct: '#538d4e',
          present: '#b59f3b',
          absent: '#3a3a3c',
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
    },
  },
  plugins: [],
}
export default config
