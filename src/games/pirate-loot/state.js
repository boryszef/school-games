/** @typedef {import("../../core/random.js").Rng} Rng */
/**
 * `splitting` waits for the answer, `choosing` for "sail again" or "retire"; `overboard` and
 * `retired` end the game.
 * @typedef {"splitting" | "choosing" | "overboard" | "retired"} GameStatus
 */
/**
 * @typedef {object} GameState
 * @property {number} trip Counted from 1.
 * @property {number} crew Pirates on this trip, the captain included.
 * @property {number} treasure Coins in this trip's chest: crew × share.
 * @property {number} loot The captain's shares from the trips won so far.
 * @property {GameStatus} status
 */

const MIN_CREW = 2;
const MAX_CREW = 10;
const MAX_SHARE = 10;
const FIRST_LIMIT_MS = 15_000;
const LIMIT_STEP_MS = 1_000;
const MIN_LIMIT_MS = 4_000;

/**
 * @param {Rng} rng
 * @returns {GameState}
 */
export function createGame(rng) {
  return { trip: 1, ..._pickTrip(rng, null), loot: 0, status: "splitting" };
}

/**
 * A random crew and treasure, never the same pair as `previous`.
 * @param {Rng} rng
 * @param {{crew: number, treasure: number} | null} previous
 * @returns {{crew: number, treasure: number}}
 */
function _pickTrip(rng, previous) {
  for (;;) {
    const crew = MIN_CREW + Math.floor(rng() * (MAX_CREW - MIN_CREW + 1));
    const treasure = crew * (1 + Math.floor(rng() * MAX_SHARE));
    if (crew !== previous?.crew || treasure !== previous.treasure) return { crew, treasure };
  }
}

/**
 * How long the crew waits for the captain's answer on a trip.
 * @param {number} trip
 */
export function answerLimitMs(trip) {
  return Math.max(MIN_LIMIT_MS, FIRST_LIMIT_MS - (trip - 1) * LIMIT_STEP_MS);
}

/**
 * The captain's answer: the share of each pirate, or null when the time ran out.
 * @param {GameState} state
 * @param {number | null} answer
 * @param {number} elapsedMs How long the answer took.
 * @returns {GameState}
 */
export function split(state, answer, elapsedMs) {
  const share = state.treasure / state.crew;
  if (answer !== share || elapsedMs > answerLimitMs(state.trip)) {
    return { ...state, loot: 0, status: "overboard" };
  }
  return { ...state, loot: state.loot + share, status: "choosing" };
}

/**
 * @param {GameState} state
 * @param {Rng} rng
 * @returns {GameState}
 */
export function sailAgain(state, rng) {
  return { ...state, trip: state.trip + 1, ..._pickTrip(rng, state), status: "splitting" };
}

/**
 * @param {GameState} state
 * @returns {GameState}
 */
export function retire(state) {
  return { ...state, status: "retired" };
}
