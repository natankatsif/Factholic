import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Настройки — из единого корневого .env (шаблон: .env.example). Переменные окружения имеют приоритет.
const ENV_FILE = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const BACKEND_URL = process.env.WEB_BACKEND_URL || "http://localhost:8787";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@news/contracts"],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_DATA_SOURCE: process.env.WEB_DATA_SOURCE || "mock",
    NEXT_PUBLIC_BACKEND_URL: BACKEND_URL,
  },
  // Сайт открыт не с этого компьютера (телефон, туннель Cloudflare): бэкенд недоступен напрямую —
  // ходим на тот же адрес, что и сайт, а Next пересылает /api/* на бэкенд (WebSocket тоже)
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
