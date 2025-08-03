/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./website/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#667eea',
          600: '#5a6fd8',
          700: '#4c63d2',
          900: '#764ba2'
        },
        brand: {
          gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem'
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      boxShadow: {
        'brand': '0 4px 12px rgba(102, 126, 234, 0.3)',
        'brand-lg': '0 8px 25px rgba(102, 126, 234, 0.4)'
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
  // Chrome extension specific optimizations
  corePlugins: {
    preflight: false, // Disable CSS reset to avoid conflicts
  }
}