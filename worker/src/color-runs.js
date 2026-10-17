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
import { createRunTable, readActions } from "./runs.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */
/** @typedef {import("../../src/games/color-invasion/colors.js").TargetLanguage} TargetLanguage */
/** @typedef {"left" | "right" | "shoot" | {to: number}} Action */

/** Time for the network on top of the round itself. */
const FINISH_GRACE_MS = 10_000;
const MAX_ACTIONS = 1000;
const COMMANDS = ["left", "right", "shoot"];
const TABLE = { name: "color_runs", variant: "lang" };

/**
 * Color Invasion rounds checked by the server: the board and colors come from a seed the server
 * chose, and the score is what replaying the player's commands with the game's rules gives.
 * @param {{db: Db, now: () => number, randomBytes: (size: number) => Uint8Array}} deps
 */
export function createColorRuns(deps) {
  const runs = createRunTable(deps, TABLE);

  return {
    /**
     * @param {string} playerId
     * @param {Record<string, unknown>} body `{lang}`
     * @returns {Promise<Reply>}
     * @throws {BadRequestError}
     */
    async start(playerId, body) {
      return { status: 201, body: await runs.start(playerId, _lang(body)) };
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
      if (finishedAt > run.startedAt + ROUND_MS + FINISH_GRACE_MS) return { status: 422 };

      const score = _replay(run.seed, actions);
      const stored = await runs.finish(runId, { score, finished_at: finishedAt });
      if (!stored) return { status: 409 };
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
