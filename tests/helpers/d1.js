import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = new URL("../../worker/migrations/", import.meta.url);

/**
 * An in-memory database with the Worker's migrations applied, behind the subset of the
 * Cloudflare D1 API the Worker uses (`prepare().bind().first()/all()/run()`).
 * @returns {import("../../worker/src/db.js").Db}
 */
export function createTestDb() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).sort()) {
    sqlite.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return { prepare: (sql) => _statement(sqlite.prepare(sql), []) };
}

/**
 * @param {import("node:sqlite").StatementSync} statement
 * @param {import("node:sqlite").SQLInputValue[]} params
 * @returns {import("../../worker/src/db.js").Statement}
 */
function _statement(statement, params) {
  return {
    bind: (...args) => _statement(statement, args),
    first: async () => {
      const row = statement.get(...params);
      return row === undefined ? null : { ...row };
    },
    all: async () => ({ results: statement.all(...params).map((row) => ({ ...row })) }),
    run: async () => ({ meta: { changes: Number(statement.run(...params).changes) } }),
  };
}
