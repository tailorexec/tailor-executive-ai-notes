/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tailor brand palette (BrandBook 2026)
        ink: {
          DEFAULT: '#010101',
          soft: '#0b0b0c',
        },
        graphite: '#878684',
        mist: '#E8E6E2',
        // Red scale from brand
        brand: {
          50: '#fdeaec',
          100: '#f9c6cc',
          200: '#f28f9a',
          300: '#e85667',
          400: '#F10C27', // vivid
          500: '#941010', // core red
          600: '#7a0d0d',
          700: '#640816', // deep
          800: '#4d0610',
          900: '#33040b',
        },
        // Semantic surface tokens driven by CSS variables (light/dark)
        surface: {
          bg: 'rgb(var(--surface-bg) / <alpha-value>)',
          card: 'rgb(var(--surface-card) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
        },
        content: {
          primary: 'rgb(var(--content-primary) / <alpha-value>)',
          secondary: 'rgb(var(--content-secondary) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
        },
        // Vermelho de destaque que adapta ao tema (texto/icone/tint). Fills solidos usam brand-500.
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        hover: '0 2px 4px rgba(0,0,0,0.05), 0 12px 28px rgba(0,0,0,0.10)',
        float: '0 8px 30px rgba(0,0,0,0.12)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        shine: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '0% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
        shine: 'shine 3s linear infinite',
      },
    },
  },
  plugins: [],
}
