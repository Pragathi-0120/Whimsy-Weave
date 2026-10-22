/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif']
      },
      colors: {
        surface: {
          light: '#f7f7f8',
          dark: '#0f0f10'
        },
        panel: {
          light: '#ffffff',
          dark: '#171717'
        },
        accent: {
          DEFAULT: '#10a37f',
          hover: '#0d8c6d'
        }
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.08)',
        'glass-dark': '0 8px 32px rgba(0,0,0,0.35)'
      },
      animation: {
        'pulse-soft': 'pulseSoft 1.4s ease-in-out infinite'
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' }
        }
      }
    }
  },
  plugins: []
};
