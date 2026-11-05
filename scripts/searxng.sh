#!/bin/sh
# Локальный SearXNG для этапа 04. Код ставится в tmp/searxng, в git не попадает.
# Запуск: sh scripts/searxng.sh, затем SEARXNG_URL=http://127.0.0.1:8899
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR="$ROOT/tmp/searxng"
if [ ! -d "$DIR/src" ]; then
  mkdir -p "$DIR"
  git clone -q --depth 1 https://github.com/searxng/searxng.git "$DIR/src"
  uv venv -q --python 3.13 "$DIR/venv"
  (cd "$DIR/src" && uv pip install -q --python "$DIR/venv/bin/python" -r requirements.txt -r requirements-server.txt)
fi
SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(24))')
sed "s/__SECRET__/$SECRET/" "$ROOT/scripts/searxng-settings.yml" > "$DIR/settings.yml"
cd "$DIR/src"
SEARXNG_SETTINGS_PATH="$DIR/settings.yml" PYTHONPATH="$DIR/src" exec "$DIR/venv/bin/python" -m searx.webapp
