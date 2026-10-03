import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["backend/**", "scripts/**", "*.mjs", "*.js", "web/*.mjs", "web/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["extension/src/**", "web/src/**", "web/app/**"],
    languageOptions: { globals: { ...globals.browser, chrome: "readonly" } },
  },
  {
    files: ["extension/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // Настройки — только через центральный конфиг
    files: ["backend/src/**"],
    ignores: ["backend/src/config.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Читай настройки через backend/src/config.ts (.env)" },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      eqeqeq: ["error", "always"],
    },
  },
);
