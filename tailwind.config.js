/* Tailwind settings for the main app, built ahead of time into css/tailwind.css (npm run css:build).
   Values follow the design system in css/design-system.css (docs/DESIGN-SYSTEM.md). */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  darkMode: 'class',
  // Badge colours chosen at runtime (exception badges: amber / blue / rose)
  safelist: [{ pattern: /^(bg|text)-(amber|blue|rose)-(100|500|600|800|300|400)$/, variants: ['dark'] }, { pattern: /^bg-(amber|blue|rose)-950\/80$/, variants: ['dark'] }],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      },
      fontSize: {
        xs: ['12px', '16px'], sm: ['14px', '20px'], base: ['16px', '24px'], lg: ['19px', '26px'],
        xl: ['22px', '28px'], '2xl': ['28px', '34px'], '3xl': ['28px', '34px'], '4xl': ['28px', '34px']
      },
      fontWeight: { light: '400', normal: '400', medium: '500', semibold: '600', bold: '700', extrabold: '700', black: '700' },
      borderRadius: { sm: '8px', DEFAULT: '8px', md: '8px', lg: '12px', xl: '12px', '2xl': '16px', '3xl': '16px' },
      colors: {
        brand: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' }
      }
    }
  }
};
