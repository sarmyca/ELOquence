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
          base: '#121215',
          primary: '#18191d',
          secondary: '#1f2024',
          tertiary: '#282a2e',
          elevated: '#313338',
        },
        text: {
          primary: '#f2f3f5',
          accent: '#dcdee1',
          secondary: '#b0b5bc',
          tertiary: '#8b919a',
          ghost: '#6b7280',
        },
        tile: {
          correct: '#5a9e54',
          present: '#c4a83d',
          absent: '#44464a',
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
