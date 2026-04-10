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
        // Couleurs principales Althea Systems
        primary: {
          DEFAULT: '#00a8b5',
          hover: '#33bfc9',
          light: '#d4f4f7',
        },
        dark: {
          DEFAULT: '#003d5c',
        },
        shell: {
          canvas: '#effbfc',
          surface: '#ffffff',
          muted: '#d4f4f7',
          ink: '#0f2f44',
        },
        // Couleurs de statuts
        status: {
          success: '#10b981',
          warning: '#F59E0B',
          error: '#ef4444',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
