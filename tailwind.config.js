/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./client/**/*.{js,jsx,ts,tsx}', './shared/**/*.{js,jsx,ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        primary: {
          DEFAULT: '#1d4ed8',
          light: '#3b82f6',
          dark: '#1e40af',
          foreground: '#ffffff',
        },

        // Secondary brand colors
        secondary: {
          DEFAULT: '#4f46e5',
          light: '#6366f1',
          dark: '#4338ca',
          foreground: '#ffffff',
        },

        // Status colors
        success: {
          DEFAULT: '#059669',
          light: '#10b981',
          dark: '#047857',
          foreground: '#ffffff',
        },

        warning: {
          DEFAULT: '#d97706',
          light: '#f59e0b',
          dark: '#b45309',
          foreground: '#ffffff',
        },

        danger: {
          DEFAULT: '#dc2626',
          light: '#ef4444',
          dark: '#b91c1c',
          foreground: '#ffffff',
        },

        // Neutral colors
        background: {
          DEFAULT: '#ffffff',
          light: '#f8fafc',
          dark: '#0f172a',
          foreground: '#1e293b',
        },

        // Text colors
        text: {
          DEFAULT: '#1e293b',
          light: '#64748b',
          dark: '#0f172a',
          muted: '#64748b',
          inverted: '#ffffff',
        },

        // Border colors
        border: {
          DEFAULT: '#e2e8f0',
          light: '#f1f5f9',
          dark: '#334155',
        },

        // Accent colors
        accent: {
          DEFAULT: '#f1f5f9',
          foreground: '#0f172a',
        },

        // Card colors
        card: {
          DEFAULT: '#ffffff',
          foreground: '#1e293b',
        },

        // Input colors
        input: {
          DEFAULT: '#ffffff',
          foreground: '#1e293b',
          border: '#e2e8f0',
        },

        // Ring colors (focus rings)
        ring: {
          DEFAULT: '#93c5fd',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        none: 'none',
      },
      borderRadius: {
        none: '0',
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      spacing: {
        72: '18rem',
        84: '21rem',
        96: '24rem',
        128: '32rem',
      },
      zIndex: {
        60: '60',
        70: '70',
        80: '80',
        90: '90',
        100: '100',
      },
    },
  },
  variants: {
    extend: {
      opacity: ['disabled'],
      backgroundColor: ['active', 'disabled'],
      textColor: ['active', 'disabled'],
      borderColor: ['active', 'disabled'],
      cursor: ['disabled'],
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
};
