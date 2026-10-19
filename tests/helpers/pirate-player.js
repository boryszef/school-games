import { createRng } from "../../src/core/random.js";
import {
  answerLimitMs,
  createGame,
  retire,
  sailAgain,
  split,
} from "../../src/games/pirate-loot/state.js";

/** @typedef {import("../../src/games/pirate-loot/state.js").GameState} GameState */
/** @typedef {{answer: number | null, ms: number} | "sail" | "retire"} PirateAction */
/**
 * How the game ends: retiring, a wrong answer, no answer in time, the right answer too late, or
 * not at all (unfinished).
 * @typedef {"retire" | "wrong" | "silent" | "late" | "none"} PirateEnd
 */
/**
 * @typedef {object} PiratePlan
 * @property {number} trips Trips won with the right answer before the end.
 * @property {PirateEnd} end
 * @property {number} [ms] How long each answer in time takes; 1000 ms by default.
 */

/**
 * Plays a Pirate Loot game from the server's seed.
 * @param {number} seed
 * @param {PiratePlan} plan
 * @returns {{actions: PirateAction[], state: GameState, answerMs: number}} `answerMs` is the
 *   sum of all answer times.
 */
export function playPirates(seed, { trips, end, ms = 1000 }) {
  const rng = createRng(seed);
  let state = createGame(rng);
  /** @type {PirateAction[]} */
  const actions = [];
  let answerMs = 0;
  const share = () => state.treasure / state.crew;
  const limit = () => answerLimitMs(state.trip);
  /**
   * Sails on (except on the first trip) and answers.
   * @param {() => number | null} pick
   * @param {() => number} took
   */
  const trip = (pick, took) => {
    if (actions.length > 0) {
      actions.push("sail");
      state = sailAgain(state, rng);
    }
    const [answer, answerTook] = [pick(), took()];
    actions.push({ answer, ms: answerTook });
    answerMs += answerTook;
    state = split(state, answer, answerTook);
  };

  for (let i = 0; i < trips; i++) trip(share, () => ms);
  if (end === "retire") {
    actions.push("retire");
    state = retire(state);
  }
  if (end === "wrong")
    trip(
      () => (share() % 10) + 1,
      () => ms,
    );
  if (end === "silent") trip(() => null, limit);
  if (end === "late") trip(share, () => limit() + 1);
  return { actions, state, answerMs };
}
