/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        card: 'var(--card)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)', 
        'text-muted': 'var(--text-muted)'
      }
    }
  },
  plugins: [],
};