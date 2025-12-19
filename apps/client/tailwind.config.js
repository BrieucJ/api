/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // <-- important for manual dark mode toggle
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
