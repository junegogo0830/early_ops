/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { navy: '#142C43', blue: '#345F89' },
        danger:  { DEFAULT: '#C46968', dark: '#673131', bg: '#F9EEEE' },
        warn:    { DEFAULT: '#C7974F', dark: '#6D4C23', bg: '#F4ECE0' },
        success: { DEFAULT: '#37846C', dark: '#164239', bg: '#E5F1ED' },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
