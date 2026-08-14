import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8fb6ff",
          400: "#5c8fff",
          500: "#3568f5",
          600: "#2249e0",
          700: "#1c3ab5",
          800: "#1c338f",
          900: "#1c2f70",
        },
      },
      fontFamily: {
        sans: [
          "Tahoma",
          "Segoe UI",
          "Arial",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
