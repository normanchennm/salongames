import type { Config } from "tailwindcss";

// Brand tokens mirror stashd's system so the two properties read as
// siblings. Ember accent, warm dark background, cream foreground.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "Consolas", "monospace"],
      },
      colors: {
        // Raw hex aliases for when you want quick access. The HSL vars
        // in globals.css are the canonical source when theming later.
        bg: "#100d0b",
        fg: "#f4ede0",
        ember: "#ee9d52",
        "ember-soft": "#b07a45",
        muted: "#8c7f70",
        border: "#2a241e",
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
