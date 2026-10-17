import { createRng } from "../../src/core/random.js";
import { COLORS, TARGET_LANGUAGES } from "../../src/games/color-invasion/colors.js";
import {
  ROUND_MS,
  createRound,
  moveShip,
  moveShipTo,
  shoot,
} from "../../src/games/color-invasion/state.js";
import { BadRequestError, hasExactly, isPlainObject } from "./http.js";
import { randomId } from "./ids.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */
/** @typedef {import("../../src/games/color-invasion/colors.js").TargetLanguage} TargetLanguage */
/** @typedef {"left" | "right" | "shoot" | {to: number}} Action */

const RUN_TTL_MS = 60 * 60 * 1000;
/** Time for the network on top of the round itself. */
const FINISH_GRACE_MS = 10_000;
const MAX_ACTIONS = 1000;
const COMMANDS = ["left", "right", "shoot"];

/**
 * Color Invasion rounds checked by the server: the board and colors come from a seed the server
 * chose, and the score is what replaying the player's commands with the game's rules gives.
 * @param {{db: Db, now: () => number, randomBytes: (size: number) => Uint8Array}} deps
 */
export function createColorRuns({ db, now, randomBytes }) {
  return {
    /**
     * @param {string} playerId
     * @param {Record<string, unknown>} body `{lang}`
     * @returns {Promise<Reply>}
     * @throws {BadRequestError}
     */
    async start(playerId, body) {
      const lang = _lang(body);
      await db
        .prepare("DELETE FROM color_runs WHERE finished_at IS NULL AND started_at <= ?")
        .bind(now() - RUN_TTL_MS)
        .run();
      const runId = randomId(randomBytes);
      const seed = new DataView(randomBytes(4).buffer).getUint32(0);
      await db
        .prepare(
          "INSERT INTO color_runs (id, player_id, seed, lang, started_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(runId, playerId, seed, lang, now())
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
          "SELECT seed, started_at, finished_at FROM color_runs WHERE id = ? AND player_id = ?",
        )
        .bind(runId, playerId)
        .first();
      if (run === null) return { status: 404 };
      const actions = _actions(body);
      if (run.finished_at !== null) return { status: 409 };
      const finishedAt = now();
      if (finishedAt > Number(run.started_at) + ROUND_MS + FINISH_GRACE_MS) return { status: 422 };

      const score = _replay(Number(run.seed), actions);
      const { meta } = await db
        .prepare(
          "UPDATE color_runs SET score = ?, finished_at = ? WHERE id = ? AND finished_at IS NULL",
        )
        .bind(score, finishedAt, runId)
        .run();
      if (meta.changes === 0) return { status: 409 };
      return { status: 200, body: { score } };
    },
  };
}

/**
 * @param {Record<string, unknown>} body
 * @returns {TargetLanguage}
 * @throws {BadRequestError}
 */
function _lang(body) {
  const { lang } = body;
  if (
    !hasExactly(body, ["lang"]) ||
    typeof lang !== "string" ||
    !Object.hasOwn(TARGET_LANGUAGES, lang)
  ) {
    throw new BadRequestError(`lang must be one of ${Object.keys(TARGET_LANGUAGES).join(", ")}`);
  }
  return /** @type {TargetLanguage} */ (lang);
}

/**
 * @param {Record<string, unknown>} body
 * @returns {Action[]}
 * @throws {BadRequestError}
 */
function _actions(body) {
  const { actions } = body;
  if (!hasExactly(body, ["actions"]) || !Array.isArray(actions)) {
    throw new BadRequestError("actions must be a list");
  }
  if (actions.length > MAX_ACTIONS) throw new BadRequestError(`more than ${MAX_ACTIONS} actions`);
  if (!actions.every(_isAction)) throw new BadRequestError("invalid action");
  return actions;
}

/**
 * @param {unknown} action
 * @returns {action is Action}
 */
function _isAction(action) {
  if (typeof action === "string") return COMMANDS.includes(action);
  return (
    isPlainObject(action) &&
    hasExactly(action, ["to"]) &&
    Number.isInteger(action.to) &&
    Number(action.to) >= 0 &&
    Number(action.to) < COLORS.length
  );
}

/**
 * @param {number} seed
 * @param {Action[]} actions
 * @returns {number} The score.
 */
function _replay(seed, actions) {
  const rng = createRng(seed);
  let state = createRound(rng);
  for (const action of actions) {
    if (typeof action === "object") state = moveShipTo(state, action.to);
    else if (action === "shoot") state = shoot(state, rng).state;
    else state = moveShip(state, action);
  }
  return state.score;
}
