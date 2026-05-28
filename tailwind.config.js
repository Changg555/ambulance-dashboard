// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        kps: {
          red:      '#C0392B',
          darkred:  '#922B21',
          lightred: '#F1948A',
        },
      },
      fontFamily: {
        sans: ['Sarabun', 'IBM Plex Sans Thai', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};