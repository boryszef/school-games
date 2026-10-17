import { createRng } from "../../src/core/random.js";
import { DIRECTIONS } from "../../src/games/robot-maze/maze.js";
import { LEVELS, answer, createGame, move } from "../../src/games/robot-maze/state.js";
import { BadRequestError, hasExactly, isPlainObject } from "./http.js";
import { createRunTable, readActions } from "./runs.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */
/** @typedef {import("../../src/games/robot-maze/maze.js").Direction} Direction */
/** @typedef {Direction | {answer: number}} Action */
/** @typedef {import("../../src/games/robot-maze/state.js").Level} Level */

/** A run can be finished within an hour of its start (R8.4). */
const RUN_TTL_MS = 60 * 60 * 1000;
/** A bigger maze needs more moves, wrong turns included. */
const MAX_ACTIONS = { standard: 2000, hard: 8000 };
const TABLE = { name: "maze_runs", variant: "level" };

/**
 * Robot Maze runs timed by the server: the maze comes from a seed the server chose, and a run
 * counts only if replaying the player's moves and answers with the game's rules reaches the exit.
 * @param {{db: Db, now: () => number, randomBytes: (size: number) => Uint8Array}} deps
 */
export function createMazeRuns(deps) {
  const runs = createRunTable(deps, TABLE);

  return {
    /**
     * @param {string} playerId
     * @param {Record<string, unknown>} body `{level}`
     * @returns {Promise<Reply>}
     * @throws {BadRequestError}
     */
    async start(playerId, body) {
      return { status: 201, body: await runs.start(playerId, _level(body)) };
    },

    /**
     * @param {string} playerId
     * @param {string} runId
     * @param {Record<string, unknown>} body `{actions}`
     * @returns {Promise<Reply>}
     * @throws {BadRequestError}
     */
    async finish(playerId, runId, body) {
      const run = await runs.find(runId, playerId);
      if (run === null || run.startedAt <= deps.now() - RUN_TTL_MS) return { status: 404 };
      const level = /** @type {Level} */ (run.variant);
      const actions = readActions(body, MAX_ACTIONS[level], _isAction);
      if (run.finished) return { status: 409 };

      const state = _replay(run.seed, level, actions);
      if (!state.finished) return { status: 422 };
      const finishedAt = deps.now();
      const timeMs = finishedAt - run.startedAt + state.penaltyMs;
      const stored = await runs.finish(runId, {
        time_ms: timeMs,
        penalty_ms: state.penaltyMs,
        finished_at: finishedAt,
      });
      if (!stored) return { status: 409 };
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
