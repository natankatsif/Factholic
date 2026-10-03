/**
 * Запускается из .husky/pre-commit. Порядок важен (--concurrent false):
 *   1. eslint + prettier — только по застейдженным файлам, автоисправление
 *   2. tsc — только по юнитам, которых касаются застейдженные файлы (scripts/units.mjs)
 */
export default {
  "*.{ts,mjs,js}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "*.{json,md,html,css}": "prettier --write",
  "*": () => "node scripts/check.mjs --staged",
};
