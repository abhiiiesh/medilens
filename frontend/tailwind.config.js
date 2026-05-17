/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hcbg: '#121212',
        hctext: '#ffffff',
        hcaccent: '#fbbf24',
      },
      animation: {
        'scan-line': 'scan 2s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(250px)' },
        }
      }
    },
  },
  plugins: [],
}
