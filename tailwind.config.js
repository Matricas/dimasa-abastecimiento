/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        concrete: { 50: '#F9FAF8', 100: '#F3F4F1', 200: '#E5E7E1', 300: '#D2D5CD', 400: '#A9ADA3' },
        graphite: { 400: '#7A8285', 500: '#5B6366', 600: '#434B4F', 700: '#2E3538', 800: '#252B2E', 900: '#1E2427' },
        signal: { 100: '#FDF3CC', 300: '#F7CF4D', 400: '#F2B705', 500: '#D9A404', 700: '#7A5C00' },
        ok: { 50: '#EAF4EE', 600: '#2F7D4F', 700: '#256440' },
        alert: { 50: '#FDECEA', 600: '#B42318', 700: '#912018' },
        steel: { 50: '#EBF0F3', 600: '#3B5B70', 700: '#2F4A5C' },
      },
      fontFamily: {
        sans: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'safety-stripe': 'repeating-linear-gradient(135deg, #F2B705 0 10px, #1E2427 10px 20px)',
        'idle-hatch': 'repeating-linear-gradient(135deg, #B42318 0 3px, #FDECEA 3px 6px)',
      },
    },
  },
  plugins: [],
}
