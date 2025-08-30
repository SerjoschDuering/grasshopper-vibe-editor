import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7B68EE',
          hover: '#6A5ACD',
        },
        secondary: '#6C757D',
        accent: '#FF6B6B',
        bg: '#F8F9FC',
        card: {
          bg: '#FFFFFF',
          border: '#E4E7ED',
        },
        text: {
          DEFAULT: '#374151',
          muted: '#6B7280',
        },
        success: '#10B981',
        warning: '#FBBF24',
        danger: '#EF4444',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      transitionProperty: {
        'DEFAULT': 'all',
      },
      transitionDuration: {
        'DEFAULT': '0.2s',
      },
      transitionTimingFunction: {
        'DEFAULT': 'ease',
      },
    },
  },
  plugins: [],
}
export default config