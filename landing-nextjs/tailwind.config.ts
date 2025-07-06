import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Monaco', 'monospace'],
        'display': ['Inter', 'system-ui', 'sans-serif']
      },
      fontWeight: {
        'extralight': '200'
      },
      colors: {
        'blink-blue': '#3b82f6',
        'blink-purple': '#8b5cf6',
        'blink-dark': '#0f172a',
        'blink-gray': '#1e293b'
      },
      animation: {
        'subtle-float': 'subtleFloat 15s ease-in-out infinite',
        'window-expand': 'windowExpand 0.4s ease-out',
        'window-minimize': 'windowMinimize 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.8s ease-out forwards',
        'fade-in': 'fadeIn 1.2s ease-out forwards'
      },
      keyframes: {
        subtleFloat: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-4px) translateX(2px)' },
          '50%': { transform: 'translateY(-2px) translateX(-1px)' },
          '75%': { transform: 'translateY(-6px) translateX(1px)' }
        },
        windowExpand: {
          '0%': { transform: 'scaleY(0.3) scaleX(0.8)', opacity: '0.7' },
          '100%': { transform: 'scaleY(1) scaleX(1)', opacity: '1' }
        },
        windowMinimize: {
          '0%': { transform: 'scaleY(1) scaleX(1)', opacity: '1' },
          '100%': { transform: 'scaleY(0.3) scaleX(0.8)', opacity: '0.7' }
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 30px rgba(59, 130, 246, 0.8)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      }
    },
  },
  plugins: [],
}
export default config