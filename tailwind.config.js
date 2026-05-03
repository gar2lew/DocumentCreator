/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#2a2d35',
          850: '#1a1d24',
          925: '#111318',
          950: '#0a0c10',
        },
      },
    },
  },
  plugins: [],
};
