module.exports = {
  content: ["./_site/**/*.html"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {},
    },
    // fontSize: {
    //   sm: '0.8rem',
    //   base: '1rem',
    //   xl: '1.25rem',
    //   '2xl': '1.563rem',
    //   '3xl': '1.953rem',
    //   '4xl': '2.441rem',
    //   '5xl': '3.052rem',
    // }
  },
  darkMode: 'media',
  variants: {},
  plugins: [
    require("@tailwindcss/typography"),
    require('flowbite/plugin')
  ],
};
