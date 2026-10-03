import type { Config } from "tailwindcss";

const config: Config = {
  // streamdown (ответы ассистента в markdown) — его классы тоже нужно собрать
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "../node_modules/streamdown/dist/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "Nunito", "system-ui", "sans-serif"],
      },
      colors: {
        // токены shadcn — на них написаны компоненты AI Elements (components/ai-elements) и streamdown
        background: "#FBF8F7",
        foreground: "#4A3333",
        muted: { DEFAULT: "#F1EBE9", foreground: "#A27C7A" },
        primary: { DEFAULT: "#4A3333", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#F1EBE9", foreground: "#4A3333" },
        accent: { DEFAULT: "#F1EBE9", foreground: "#4A3333" },
        destructive: { DEFAULT: "#E2353F", foreground: "#FFFFFF" },
        border: "#E3D9D6",
        input: "#E3D9D6",
        ring: "#4A3333",
        sidebar: "#F1EBE9",
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
