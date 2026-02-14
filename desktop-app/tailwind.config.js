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
        // Clean Dark Software Design
        background: {
          DEFAULT: '#0a0a0c',
          surface: '#111114',
          'surface-solid': '#16161a',
          'surface-hover': '#1c1c21',
          elevated: '#202026',
          card: '#131316',
        },
        text: {
          primary: '#FAFAFA',
          secondary: '#A1A1AA',
          subtle: '#71717A',
          muted: '#52525B',
        },
        accent: {
          primary: '#8B5CF6',
          'primary-dim': '#7C3AED',
          'primary-glow': 'rgba(139, 92, 246, 0.15)',
          secondary: '#A78BFA',
          cyan: '#06B6D4',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          light: 'rgba(255, 255, 255, 0.12)',
          accent: 'rgba(139, 92, 246, 0.3)',
        },
        pnl: {
          positive: '#22C55E',
          'positive-dim': 'rgba(34, 197, 94, 0.15)',
          negative: '#EF4444',
          'negative-dim': 'rgba(239, 68, 68, 0.15)',
          neutral: '#71717A',
        },
        surface: {
          DEFAULT: '#131316',
          hover: '#1a1a1e',
          active: '#202024',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
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
        'gradient-card': 'linear-gradient(135deg, rgba(139,92,246,0.05) 0%, rgba(6,182,212,0.03) 100%)',
        'gradient-accent': 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
        'gradient-success': 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)',
        'gradient-danger': 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        'gradient-surface': 'linear-gradient(180deg, rgba(19,19,22,0.9) 0%, rgba(10,10,12,1) 100%)',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-sm': '0 0 10px rgba(139, 92, 246, 0.2)',
        'glow-lg': '0 0 40px rgba(139, 92, 246, 0.2), 0 0 80px rgba(139, 92, 246, 0.1)',
        'depth': '0 1px 2px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.2)',
        'depth-lg': '0 2px 4px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.3), 0 16px 32px rgba(0,0,0,0.2)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.05)',
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
