import { createRng } from "../../src/core/random.js";
import { createGame, retire, sailAgain, split } from "../../src/games/pirate-loot/state.js";
import { BadRequestError, hasExactly, isPlainObject } from "./http.js";
import { createRunTable, readActions } from "./runs.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */
/** @typedef {import("../../src/games/pirate-loot/state.js").GameState} GameState */
/** @typedef {import("../../src/core/random.js").Rng} Rng */
/** @typedef {{answer: number | null, ms: number} | "sail" | "retire"} Action */

const RUN_TTL_MS = 60 * 60 * 1000;
const MAX_ACTIONS = 1000;
const MAX_ANSWER = 10;
const TABLE = { name: "pirate_runs", variant: null };

/**
 * Pirate Loot games checked by the server: every crew and treasure comes from a seed the server
 * chose, and the score is what replaying the player's actions with the game's rules gives.
 * @param {{db: Db, now: () => number, randomBytes: (size: number) => Uint8Array}} deps
 */
export function createPirateRuns(deps) {
  const runs = createRunTable(deps, TABLE);

  return {
    /**
     * @param {string} playerId
     * @param {Record<string, unknown>} body `{}`
     * @returns {Promise<Reply>}
     * @throws {BadRequestError}
     */
    async start(playerId, body) {
      if (!hasExactly(body, [])) throw new BadRequestError("the body must be empty");
      return { status: 201, body: await runs.start(playerId, null) };
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
      if (run === null) return { status: 404 };
      const actions = readActions(body, MAX_ACTIONS, _isAction);
      if (run.finished) return { status: 409 };
      const finishedAt = deps.now();
      const elapsedMs = finishedAt - run.startedAt;
      if (elapsedMs > RUN_TTL_MS || _answerMs(actions) > elapsedMs) return { status: 422 };

      const score = _replay(run.seed, actions);
      const stored = await runs.finish(runId, { score, finished_at: finishedAt });
      if (!stored) return { status: 409 };
      return { status: 200, body: { score } };
    },
  };
}

/**
 * @param {unknown} action
 * @returns {action is Action}
 */
function _isAction(action) {
  if (action === "sail" || action === "retire") return true;
  if (!isPlainObject(action) || !hasExactly(action, ["answer", "ms"])) return false;
  const { answer, ms } = action;
  return (
    (answer === null ||
      (Number.isInteger(answer) && Number(answer) >= 1 && Number(answer) <= MAX_ANSWER)) &&
    Number.isInteger(ms) &&
    Number(ms) >= 0
  );
}

/**
 * How long the answers took together, as the browser measured them.
 * @param {Action[]} actions
 */
function _answerMs(actions) {
  return actions.reduce((sum, action) => sum + (typeof action === "object" ? action.ms : 0), 0);
}

/**
 * @param {number} seed
 * @param {Action[]} actions
 * @returns {number} The score: the loot, which is 0 after going overboard.
 * @throws {BadRequestError} When the actions don't follow the game or don't end it.
 */
function _replay(seed, actions) {
  const rng = createRng(seed);
  let state = createGame(rng);
  for (const action of actions) state = _apply(state, action, rng);
  if (state.status !== "retired" && state.status !== "overboard") {
    throw new BadRequestError("the game hasn't ended");
  }
  return state.loot;
}

/**
 * @param {GameState} state
 * @param {Action} action
 * @param {Rng} rng
 * @returns {GameState}
 * @throws {BadRequestError}
 */
function _apply(state, action, rng) {
  if (state.status === "splitting" && typeof action === "object") {
    return split(state, action.answer, action.ms);
  }
  if (state.status === "choosing" && action === "sail") return sailAgain(state, rng);
  if (state.status === "choosing" && action === "retire") return retire(state);
  throw new BadRequestError(`${JSON.stringify(action)} doesn't follow the game (${state.status})`);
}
