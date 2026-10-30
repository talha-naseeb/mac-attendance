/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        macq: {
          navy: '#002C52',
          dark: '#001D38',
          orange: '#FE5800',
          teal: '#007A78',
          coral: '#D9381E',
          surfaceLight: '#F8FAFC',
          surfaceDark: '#0B1524',
          cardDark: '#122035',
          borderDark: '#1E3250',
        },
      },
    },
  },
  plugins: [],
};
