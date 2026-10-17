import { COLORS } from "./colors.js";

/** @typedef {import("../../core/random.js").Rng} Rng */
/** @typedef {{color: string, boxes: number}} Column */
/**
 * @typedef {object} RoundState
 * @property {Column[]} columns Left to right.
 * @property {number} shipColumn
 * @property {string} target The color id to shoot.
 * @property {number} score
 * @property {number} hits
 * @property {number} misses
 * @property {number} clears Columns emptied by correct hits.
 */
/** @typedef {"hit" | "clear" | "miss"} ShotOutcome */

export const ROUND_MS = 60_000;
export const BOXES_PER_COLUMN = 5;
export const CLEAR_BONUS = 5;
const HIT_POINTS = 1;
const MISS_POINTS = -1;

/**
 * @param {Rng} rng
 * @returns {RoundState}
 */
export function createRound(rng) {
  const colors = _shuffle(
    COLORS.map((color) => color.id),
    rng,
  );
  return {
    columns: colors.map((color) => ({ color, boxes: BOXES_PER_COLUMN })),
    shipColumn: Math.floor(colors.length / 2),
    target: colors[Math.floor(rng() * colors.length)],
    score: 0,
    hits: 0,
    misses: 0,
    clears: 0,
  };
}

/**
 * Fisher–Yates shuffle into a new array.
 * @template T
 * @param {T[]} items
 * @param {Rng} rng
 */
function _shuffle(items, rng) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * @param {RoundState} state
 * @param {"left" | "right"} dir
 * @returns {RoundState} The same state when the ship is already at that edge.
 */
export function moveShip(state, dir) {
  const column = state.shipColumn + (dir === "left" ? -1 : 1);
  if (column < 0 || column >= state.columns.length) return state;
  return moveShipTo(state, column);
}

/**
 * @param {RoundState} state
 * @param {number} column
 * @returns {RoundState}
 */
export function moveShipTo(state, column) {
  return { ...state, shipColumn: column };
}

/**
 * Shoots the lowest box above the ship, then picks the next target.
 * @param {RoundState} state
 * @param {Rng} rng
 * @returns {{state: RoundState, outcome: ShotOutcome}}
 */
export function shoot(state, rng) {
  const column = state.columns[state.shipColumn];
  const target = _pickTarget(state.target, rng);
  if (column.color !== state.target) {
    return {
      state: { ...state, target, score: state.score + MISS_POINTS, misses: state.misses + 1 },
      outcome: "miss",
    };
  }
  const cleared = column.boxes === 1;
  const columns = state.columns.map((other, i) =>
    i === state.shipColumn
      ? { color: other.color, boxes: cleared ? BOXES_PER_COLUMN : other.boxes - 1 }
      : other,
  );
  return {
    state: {
      ...state,
      columns,
      target,
      score: state.score + HIT_POINTS + (cleared ? CLEAR_BONUS : 0),
      hits: state.hits + 1,
      clears: state.clears + (cleared ? 1 : 0),
    },
    outcome: cleared ? "clear" : "hit",
  };
}

/**
 * @param {string} previous
 * @param {Rng} rng
 */
function _pickTarget(previous, rng) {
  const others = COLORS.map((color) => color.id).filter((id) => id !== previous);
  return others[Math.floor(rng() * others.length)];
}
