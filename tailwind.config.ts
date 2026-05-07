import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0C2340',
          50:  '#eef3f9',
          100: '#cddaea',
          200: '#9cb5d4',
          600: '#1a3a5c',
          700: '#0f2a4a',
          800: '#0C2340',
          900: '#061525',
        },
        brand: {
          green: {
            DEFAULT: '#00A650',
            dark:   '#008a42',
            50:     '#e6f7ee',
            100:    '#b3e8cd',
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
