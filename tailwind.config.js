/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#ff5a1f',
          'orange-light': '#ff8c42',
          dark: '#0a0a0a',
          'dark-2': '#0f0f0f',
          'dark-3': '#161616',
          border: '#1a1a1a',
          'border-2': '#2a2a2a',
          text: '#f5f1eb',
          'text-dim': '#888',
          'text-dimmer': '#555',
        },
      },
    },
  },
  plugins: [],
}
