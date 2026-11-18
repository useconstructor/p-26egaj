import { db } from "./db";

let ready: Promise<void> | null = null;

/**
 * Create this project's tables once per server instance. Replace the example with the
 * business tables the brief needs (CREATE TABLE IF NOT EXISTS ...). Call
 * `await ensureSchema()` at the start of every route handler or server action that
 * reads or writes the database. Owner access needs no table (see owner-access.ts).
 */
export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = db
      .batch(
        [
          {
            sql: `CREATE TABLE IF NOT EXISTS app_meta (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            )`,
            args: [],
          },
        ],
        "write",
      )
      .then(() => {})
      .catch((error) => { ready = null; throw error; });
  }
  return ready;
}
