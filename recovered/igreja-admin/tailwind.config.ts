import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        church: {
          50: '#f9f7f4',
          100: '#f3ede6',
          200: '#e8dcd4',
          300: '#d9c5bb',
          400: '#c4a998',
          500: '#b38f7f',
          600: '#9d7866',
          700: '#7d5c4a',
          800: '#5f4533',
          900: '#3d2c1f'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Lora', 'serif']
      }
    }
  },
  plugins: []
}

export default config
