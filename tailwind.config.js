/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        navy: {
          900: "#040d1a",
          800: "#071428",
          700: "#0a1c38",
          600: "#0f2548",
        },
        cyan: {
          glow: "#00f5ff",
        },
      },
      boxShadow: {
        cyan: "0 0 20px rgba(0, 245, 255, 0.3)",
        "cyan-lg": "0 0 40px rgba(0, 245, 255, 0.2)",
      },
    },
  },
  plugins: [],
};
