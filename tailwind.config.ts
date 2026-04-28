import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          900: '#0c0a0e',
          800: '#16131a',
          700: '#211d28',
          600: '#2e2838',
          500: '#3d3550',
        },
        parchment: {
          50: '#fdf8f0',
          100: '#f5e6c8',
          200: '#e8cc8a',
          300: '#d4aa60',
        },
        gold: {
          300: '#f0d070',
          400: '#e8b830',
          500: '#c89010',
          600: '#a07008',
        },
        blood: {
          400: '#b22222',
          500: '#8b1a1a',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        body: ['Crimson Text', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(232, 184, 48, 0.3)',
        'glow-red': '0 0 20px rgba(178, 34, 34, 0.4)',
        card: '0 4px 24px rgba(0, 0, 0, 0.6)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.8)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #e8b830, #f0d070)',
        'dark-gradient': 'linear-gradient(135deg, #16131a, #211d28)',
      },
    },
  },
  plugins: [],
} satisfies Config
