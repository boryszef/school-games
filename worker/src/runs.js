import { BadRequestError, hasExactly } from "./http.js";
import { randomId } from "./ids.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./db.js").Value} Value */
/**
 * A table of server-checked game runs. Both names are constants in the code, never input.
 * @typedef {object} RunTableName
 * @property {string} name
 * @property {string | null} variant The column that tells the runs apart, such as the level;
 *   null for a game with one kind of run.
 */
/**
 * @typedef {object} StoredRun
 * @property {number} seed
 * @property {string | null} variant
 * @property {number} startedAt
 * @property {boolean} finished
 */

/** Unfinished runs older than this are deleted whenever a new run starts. */
const STALE_RUN_MS = 60 * 60 * 1000;

/**
 * The parts every server-checked game shares: a run starts with a seed the server chose and
 * can be finished once, by its own player.
 * @param {{db: Db, now: () => number, randomBytes: (size: number) => Uint8Array}} deps
 * @param {RunTableName} table
 */
export function createRunTable({ db, now, randomBytes }, { name, variant }) {
  return {
    /**
     * @param {string} playerId
     * @param {string | null} variantValue Null when the table has no variant.
     * @returns {Promise<{runId: string, seed: number}>}
     */
    async start(playerId, variantValue) {
      await db
        .prepare(`DELETE FROM ${name} WHERE finished_at IS NULL AND started_at <= ?`)
        .bind(now() - STALE_RUN_MS)
        .run();
      const runId = randomId(randomBytes);
      const seed = new DataView(randomBytes(4).buffer).getUint32(0);
      const columns = { id: runId, player_id: playerId, seed, started_at: now() };
      if (variant !== null) Object.assign(columns, { [variant]: variantValue });
      await db
        .prepare(
          `INSERT INTO ${name} (${Object.keys(columns).join(", ")})
           VALUES (${Object.keys(columns).fill("?").join(", ")})`,
        )
        .bind(...Object.values(columns))
        .run();
      return { runId, seed };
    },

    /**
     * @param {string} runId
     * @param {string} playerId
     * @returns {Promise<StoredRun | null>} Null for an unknown run or another player's.
     */
    async find(runId, playerId) {
      const row = await db
        .prepare(
          `SELECT seed, ${variant ?? "NULL"} AS variant, started_at, finished_at FROM ${name}
           WHERE id = ? AND player_id = ?`,
        )
        .bind(runId, playerId)
        .first();
      if (row === null) return null;
      return {
        seed: Number(row.seed),
        variant: row.variant === null ? null : String(row.variant),
        startedAt: Number(row.started_at),
        finished: row.finished_at !== null,
      };
    },

    /**
     * Stores the result, unless another request finished the run first.
     * @param {string} runId
     * @param {Record<string, Value>} results Column values, `finished_at` included.
     * @returns {Promise<boolean>} False when the run was already finished.
     */
    async finish(runId, results) {
      const columns = Object.keys(results);
      const { meta } = await db
        .prepare(
          `UPDATE ${name} SET ${columns.map((column) => `${column} = ?`).join(", ")}
           WHERE id = ? AND finished_at IS NULL`,
        )
        .bind(...Object.values(results), runId)
        .run();
      return meta.changes > 0;
    },
  };
}

/**
 * @template Action
 * @param {Record<string, unknown>} body `{actions}`
 * @param {number} maxActions
 * @param {(action: unknown) => action is Action} isAction
 * @returns {Action[]}
 * @throws {BadRequestError}
 */
export function readActions(body, maxActions, isAction) {
  const { actions } = body;
  if (!hasExactly(body, ["actions"]) || !Array.isArray(actions)) {
    throw new BadRequestError("actions must be a list");
  }
  if (actions.length > maxActions) throw new BadRequestError(`more than ${maxActions} actions`);
  if (!actions.every(isAction)) throw new BadRequestError("invalid action");
  return actions;
}
