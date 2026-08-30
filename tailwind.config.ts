import type { Config } from "tailwindcss";

/**
 * WorshipFlow design tokens.
 * Brand + gold are driven by CSS variables so the whole identity can be
 * re-themed from settings without touching this file.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(var(--wf-brand-50) / <alpha-value>)",
          100: "rgb(var(--wf-brand-100) / <alpha-value>)",
          200: "rgb(var(--wf-brand-200) / <alpha-value>)",
          300: "rgb(var(--wf-brand-300) / <alpha-value>)",
          400: "rgb(var(--wf-brand-400) / <alpha-value>)",
          500: "rgb(var(--wf-brand-500) / <alpha-value>)",
          600: "rgb(var(--wf-brand-600) / <alpha-value>)",
          700: "rgb(var(--wf-brand-700) / <alpha-value>)",
          800: "rgb(var(--wf-brand-800) / <alpha-value>)",
          900: "rgb(var(--wf-brand-900) / <alpha-value>)",
          950: "rgb(var(--wf-brand-950) / <alpha-value>)",
        },
        gold: {
          50: "rgb(var(--wf-gold-50) / <alpha-value>)",
          100: "rgb(var(--wf-gold-100) / <alpha-value>)",
          200: "rgb(var(--wf-gold-200) / <alpha-value>)",
          300: "rgb(var(--wf-gold-300) / <alpha-value>)",
          400: "rgb(var(--wf-gold-400) / <alpha-value>)",
          500: "rgb(var(--wf-gold-500) / <alpha-value>)",
          600: "rgb(var(--wf-gold-600) / <alpha-value>)",
          700: "rgb(var(--wf-gold-700) / <alpha-value>)",
          800: "rgb(var(--wf-gold-800) / <alpha-value>)",
          900: "rgb(var(--wf-gold-900) / <alpha-value>)",
        },
        paper: "rgb(var(--wf-paper) / <alpha-value>)",
        ink: "rgb(var(--wf-ink) / <alpha-value>)",
        line: "rgb(var(--wf-line) / <alpha-value>)",
        surface: "rgb(var(--wf-surface) / <alpha-value>)",
        accent: {
          DEFAULT: "#a30601",
          dark: "#b81a13",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,24,18,0.05), 0 6px 20px rgba(28,24,18,0.06)",
        pop: "0 8px 40px rgba(28,24,18,0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
