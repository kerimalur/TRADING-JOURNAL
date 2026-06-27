/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // TradeSync Pro Light Design
        background: {
          DEFAULT: '#F1F5F9',
          surface: '#FFFFFF',
          'surface-solid': '#FFFFFF',
          'surface-hover': '#F8FAFC',
          elevated: '#FFFFFF',
          card: '#FFFFFF',
        },
        text: {
          primary: '#0F172A',
          secondary: '#64748B',
          subtle: '#94A3B8',
          muted: '#64748B',
        },
        accent: {
          primary: '#2563EB',
          'primary-dim': '#1D4ED8',
          'primary-glow': 'rgba(37, 99, 235, 0.12)',
          secondary: '#3B82F6',
          cyan: '#3B82F6',
          gold: '#F59E0B',
        },
        border: {
          DEFAULT: '#E2E8F0',
          light: '#CBD5E1',
          accent: 'rgba(37, 99, 235, 0.3)',
        },
        pnl: {
          positive: '#10B981',
          'positive-dim': 'rgba(16, 185, 129, 0.12)',
          negative: '#EF4444',
          'negative-dim': 'rgba(239, 68, 68, 0.12)',
          neutral: '#94A3B8',
        },
        be: {
          DEFAULT: '#F59E0B',
          bg: '#FEF3C7',
        },
        win: {
          DEFAULT: '#10B981',
          bg: '#D1FAE5',
        },
        loss: {
          DEFAULT: '#EF4444',
          bg: '#FEE2E2',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F8FAFC',
          active: '#F1F5F9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'headline': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'title': ['1.125rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
      },
      borderRadius: {
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-card': 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(59,130,246,0.02) 100%)',
        'gradient-accent': 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
        'gradient-success': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'gradient-danger': 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        'gradient-surface': 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
        'subtle': '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        'hover': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
        'glow': '0 4px 12px rgba(37, 99, 235, 0.15)',
        'glow-sm': '0 2px 8px rgba(37, 99, 235, 0.12)',
        'glow-lg': '0 10px 24px rgba(37, 99, 235, 0.18)',
        'depth': '0 1px 2px rgba(15,23,42,0.04), 0 4px 8px rgba(15,23,42,0.04), 0 8px 16px rgba(15,23,42,0.03)',
        'depth-lg': '0 2px 4px rgba(15,23,42,0.05), 0 8px 16px rgba(15,23,42,0.05), 0 16px 32px rgba(15,23,42,0.04)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'draw': 'draw 1.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        draw: {
          '0%': { strokeDashoffset: '1' },
          '100%': { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}
