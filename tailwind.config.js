/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#FDE047', // yellow-300
          DEFAULT: '#FACC15', // yellow-400
          dark: '#EAB308', // yellow-500
        },
        secondary: {
          light: '#60A5FA', // blue-400
          DEFAULT: '#2563EB', // blue-600
          dark: '#1E40AF', // blue-800
        },
        accent: {
          gold: '#B45309', // amber-700 for progress bar
        },
        background: '#FFFFFF',
      },
      animation: {
        'bounce-subtle': 'bounce-subtle 3s ease-in-out infinite',
      },
      keyframes: {
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}
