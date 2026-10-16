import { createRng } from "../../src/core/random.js";
import { DIRECTIONS } from "../../src/games/robot-maze/maze.js";
import { LEVELS, answer, createGame, move } from "../../src/games/robot-maze/state.js";
import { BadRequestError, hasExactly, isPlainObject } from "./http.js";
import { randomId } from "./ids.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */
/** @typedef {import("../../src/games/robot-maze/maze.js").Direction} Direction */
/** @typedef {Direction | {answer: number}} Action */
/** @typedef {import("../../src/games/robot-maze/state.js").Level} Level */

const RUN_TTL_MS = 60 * 60 * 1000;
/** A bigger maze needs more moves, wrong turns included. */
const MAX_ACTIONS = { standard: 2000, hard: 8000 };

/**
 * Robot Maze runs timed by the server: the maze comes from a seed the server chose, and a run
 * counts only if replaying the player's moves and answers with the game's rules reaches the exit.
 * @param {{db: Db, now: () => number, randomBytes: (size: number) => Uint8Array}} deps
 */
export function createMazeRuns({ db, now, randomBytes }) {
  const oldest = () => now() - RUN_TTL_MS;

  return {
    /**
     * @param {string} playerId
     * @param {Record<string, unknown>} body `{level}`
     * @returns {Promise<Reply>}
     * @throws {BadRequestError}
     */
    async start(playerId, body) {
      const level = _level(body);
      await db
        .prepare("DELETE FROM maze_runs WHERE finished_at IS NULL AND started_at <= ?")
        .bind(oldest())
        .run();
      const runId = randomId(randomBytes);
      const seed = new DataView(randomBytes(4).buffer).getUint32(0);
      await db
        .prepare(
          "INSERT INTO maze_runs (id, player_id, seed, level, started_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(runId, playerId, seed, level, now())
        .run();
      return { status: 201, body: { runId, seed } };
    },

    /**
     * @param {string} playerId
     * @param {string} runId
     * @param {Record<string, unknown>} body `{actions}`
     * @returns {Promise<Reply>}
     * @throws {BadRequestError}
     */
    async finish(playerId, runId, body) {
      const run = await db
        .prepare(
          `SELECT seed, level, started_at, finished_at FROM maze_runs
           WHERE id = ? AND player_id = ? AND started_at > ?`,
        )
        .bind(runId, playerId, oldest())
        .first();
      if (run === null) return { status: 404 };
      const level = /** @type {Level} */ (run.level);
      const actions = _actions(body, MAX_ACTIONS[level]);
      if (run.finished_at !== null) return { status: 409 };

      const state = _replay(Number(run.seed), level, actions);
      if (!state.finished) return { status: 422 };
      const finishedAt = now();
      const timeMs = finishedAt - Number(run.started_at) + state.penaltyMs;
      const { meta } = await db
        .prepare(
          `UPDATE maze_runs SET time_ms = ?, penalty_ms = ?, finished_at = ?
           WHERE id = ? AND finished_at IS NULL`,
        )
        .bind(timeMs, state.penaltyMs, finishedAt, runId)
        .run();
      if (meta.changes === 0) return { status: 409 };
      return { status: 200, body: { timeMs, penaltyMs: state.penaltyMs } };
    },
  };
}

/**
 * @param {Record<string, unknown>} body
 * @returns {Level}
 * @throws {BadRequestError}
 */
function _level(body) {
  const { level } = body;
  if (!hasExactly(body, ["level"]) || typeof level !== "string" || !Object.hasOwn(LEVELS, level)) {
    throw new BadRequestError(`level must be one of ${Object.keys(LEVELS).join(", ")}`);
  }
  return /** @type {Level} */ (level);
}

/**
 * @param {Record<string, unknown>} body
 * @param {number} maxActions
 * @returns {Action[]}
 * @throws {BadRequestError}
 */
function _actions(body, maxActions) {
  const { actions } = body;
  if (!hasExactly(body, ["actions"]) || !Array.isArray(actions)) {
    throw new BadRequestError("actions must be a list");
  }
  if (actions.length > maxActions) throw new BadRequestError(`more than ${maxActions} actions`);
  if (!actions.every(_isAction)) throw new BadRequestError("invalid action");
  return actions;
}

/**
 * @param {unknown} action
 * @returns {action is Action}
 */
function _isAction(action) {
  if (typeof action === "string") return DIRECTIONS.includes(/** @type {Direction} */ (action));
  return (
    isPlainObject(action) &&
    hasExactly(action, ["answer"]) &&
    Number.isSafeInteger(action.answer) &&
    Number(action.answer) >= 0
  );
}

/**
 * @param {number} seed
 * @param {Level} level
 * @param {Action[]} actions
 */
function _replay(seed, level, actions) {
  let state = createGame({ ...LEVELS[level], rng: createRng(seed) });
  for (const action of actions) {
    state = typeof action === "string" ? move(state, action) : answer(state, action.answer);
  }
  return state;
}
