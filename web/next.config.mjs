import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Настройки — из единого корневого .env (шаблон: .env.example). Переменные окружения имеют приоритет.
const ENV_FILE = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@news/contracts"],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_DATA_SOURCE: process.env.WEB_DATA_SOURCE || "mock",
    NEXT_PUBLIC_BACKEND_URL: process.env.WEB_BACKEND_URL || "http://localhost:8787",
  },
};

export default nextConfig;
