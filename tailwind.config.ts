import type { Config } from 'tailwindcss';

/**
 * Tokens de diseño. Son el punto de entrada para lo que salga de Claude
 * Design: cambiando estos valores cambia todo el juego.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: '#04101d',
        hull: '#0a1f33',
        deck: '#123249',
        sea: '#1b4f72',
        foam: '#e8f2f8',
        gold: '#f2b134',
        ember: '#e2542c',
        blood: '#8c1f1f',
        jolly: '#f5f0e6',
      },
      fontFamily: {
        display: ['"Trebuchet MS"', 'Verdana', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        plank: '0 2px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        glow: '0 0 24px rgba(242,177,52,0.35)',
      },
      keyframes: {
        splash: {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        sway: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        splash: 'splash 320ms ease-out',
        sway: 'sway 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
