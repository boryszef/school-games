import { createRng } from "../../src/core/random.js";
import { createRound, shoot } from "../../src/games/color-invasion/state.js";

/** @typedef {import("../../src/games/color-invasion/state.js").RoundState} RoundState */
/** @typedef {"left" | "right" | "shoot" | {to: number}} ColorAction */

/**
 * Plays a Color Invasion round from the server's seed: each hit moves under the target and
 * shoots, each miss (played after the hits) moves under another color and shoots.
 * @param {number} seed
 * @param {{hits: number, misses?: number}} plan
 * @returns {{actions: ColorAction[], state: RoundState}}
 */
export function playColors(seed, { hits, misses = 0 }) {
  const rng = createRng(seed);
  let state = createRound(rng);
  /** @type {ColorAction[]} */
  const actions = [];
  /** @param {(column: {color: string}) => boolean} pick */
  const shootAt = (pick) => {
    const to = state.columns.findIndex(pick);
    actions.push({ to }, "shoot");
    state = shoot({ ...state, shipColumn: to }, rng).state;
  };
  for (let i = 0; i < hits; i++) shootAt((column) => column.color === state.target);
  for (let i = 0; i < misses; i++) shootAt((column) => column.color !== state.target);
  return { actions, state };
}
