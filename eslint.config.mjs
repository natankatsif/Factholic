import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["backend/**", "scripts/**", "*.mjs", "*.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["extension/**"],
    languageOptions: { globals: { ...globals.browser, chrome: "readonly" } },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      eqeqeq: ["error", "always"],
    },
  },
);
