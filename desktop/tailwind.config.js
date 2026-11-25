/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-fg": "rgb(var(--accent-fg) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        urgent: "rgb(var(--urgent) / <alpha-value>)",
        "urgent-soft": "rgb(var(--urgent-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', "system-ui", "-apple-system", "sans-serif"],
        serif: ['"Georgia"', '"Times New Roman"', "serif"],
        mono: ['"Cascadia Code"', '"Consolas"', "monospace"],
      },
    },
  },
  plugins: [],
};
