import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-f25)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
