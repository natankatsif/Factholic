# Бэкенд FactCheck: сервер + пайплайн. Собирать ИЗ КОРНЯ репозитория (нужны packages/contracts и lockfile):
#
#   docker build -f backend/Dockerfile -t factcheck-backend .
#   docker run --rm -p 8787:8787 --env-file .env factcheck-backend
#
# Ключи — только через --env-file / -e при запуске, в образ .env не попадает (см. Dockerfile.dockerignore).
# Готовые отчёты (кэш) живут в /tmp контейнера; чтобы переживали перезапуск: -v factcheck-cache:/tmp

FROM node:24-slim

# ffmpeg — нарезка звука (этап 01); python3 — для yt-dlp
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp — свежий релиз с GitHub, а не из apt: YouTube регулярно ломает старые версии
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app

# Сначала только package.json всех workspaces + lockfile — слой с зависимостями кэшируется,
# пока они не меняются (npm ci сверяет lockfile со всеми workspaces, поэтому нужны все package.json)
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
COPY extension/package.json extension/
COPY web/package.json web/
# только бэкенд и контракты; --ignore-scripts — без husky (в образе нет git)
RUN npm ci --workspace backend --workspace packages/contracts --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY backend backend

ENV NODE_ENV=production PORT=8787
EXPOSE 8787
# tsx запускает TypeScript напрямую — в проекте нет шага сборки
CMD ["npx", "tsx", "backend/src/server.ts"]
