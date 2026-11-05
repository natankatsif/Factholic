/**
 * Постоянное хранилище кабинета: один файл SQLite, встроенный в Node, без новых зависимостей.
 * Записи лежат как JSON по видам: схема меняется вместе с типами. Для общего сервера это место меняется на Postgres:
 * остальной код знает только методы ниже.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type DocKind =
  "claim" | "check" | "watch" | "alert" | "narrative" | "suggestion" | "report" | "clarification";

export class CabinetDb {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS docs (
      kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (kind, id)
    )`);
  }

  put<T extends { id: string }>(kind: DocKind, doc: T): T {
    this.db
      .prepare("INSERT OR REPLACE INTO docs (kind, id, data) VALUES (?, ?, ?)")
      .run(kind, doc.id, JSON.stringify(doc));
    return doc;
  }

  get<T>(kind: DocKind, id: string): T | undefined {
    const row = this.db.prepare("SELECT data FROM docs WHERE kind = ? AND id = ?").get(kind, id) as
      { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  list<T>(kind: DocKind): T[] {
    const rows = this.db.prepare("SELECT data FROM docs WHERE kind = ?").all(kind) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  remove(kind: DocKind, id: string): void {
    this.db.prepare("DELETE FROM docs WHERE kind = ? AND id = ?").run(kind, id);
  }

  close(): void {
    this.db.close();
  }
}
