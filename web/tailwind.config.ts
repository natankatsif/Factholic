import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "Nunito", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: "#F1EBE9",
        card: "#FBF8F7",
        brand: {
          dark: "#4A3333",
          muted: "#A27C7A",
          border: "#E3D9D6",
        },
        lavender: {
          50: "#FAF7FE",
          100: "#F3ECFE",
          200: "#E8DCFD",
          300: "#D6BFFB",
          500: "#8B5CF6",
          700: "#6D28D9",
        },
      },
    },
  },
  plugins: [],
};

export default config;
