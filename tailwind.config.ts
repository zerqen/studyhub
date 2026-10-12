import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        serif: ["var(--font-literata)", "Georgia", "serif"],
      },
      colors: {
        ink: {
          50: "#ffffff",
          100: "#f9f6f4",
          200: "#f5ebe6",
          300: "#e2c2b3",
          400: "#cfa18a",
          500: "#b86e47",
          600: "#9b5838",
          700: "#704332",
          800: "#4d3026",
          900: "#2b1e19",
          950: "#1e1410",
        },
        accent: {
          DEFAULT: "#b86e47",
          fg: "#ffffff",
        },
        info: "#3b82f6",
        success: "#5f8f72",
      },
      boxShadow: {
        card: "0 1px 2px rgba(43, 30, 25, 0.04), 0 8px 20px rgba(43, 30, 25, 0.06)",
        pop: "0 16px 48px rgba(43, 30, 25, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
