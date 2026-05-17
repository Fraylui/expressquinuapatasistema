/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e8ecf3',
          100: '#c5cfe2',
          200: '#9eafd0',
          300: '#778fbd',
          400: '#5a76b0',
          500: '#3d5ca3',
          600: '#37549b',
          700: '#2f4a91',
          800: '#274187',
          900: '#1F3864',
          DEFAULT: '#1F3864',
        },
        accent: {
          50:  '#e0f0fb',
          100: '#b3d9f5',
          200: '#80c0ef',
          300: '#4da7e8',
          400: '#2694e3',
          500: '#0081de',
          600: '#0076d6',
          700: '#0070C0',
          DEFAULT: '#0070C0',
          800: '#005fad',
          900: '#00438c',
        },
        sidebar: '#1F3864',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
