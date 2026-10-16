import assert from "node:assert/strict";
import { createRng } from "../../src/core/random.js";
import { DIRECTIONS, stepFrom } from "../../src/games/robot-maze/maze.js";
import { findPath } from "../../src/games/robot-maze/path.js";
import { LEVELS, answer, createGame, move } from "../../src/games/robot-maze/state.js";

/** @typedef {import("../../src/games/robot-maze/maze.js").Direction | {answer: number}} Action */

/**
 * The actions of an honest Robot Maze run on the shortest path, as the browser records them.
 * @param {number} seed
 * @param {{wrongAnswers?: number, level?: keyof typeof LEVELS}} [options] `wrongAnswers`: how many
 *   robots first get a wrong answer.
 * @returns {Action[]}
 */
export function solveActions(seed, { wrongAnswers = 0, level = "standard" } = {}) {
  let state = createGame({ ...LEVELS[level], rng: createRng(seed) });
  /** @type {Action[]} */
  const actions = [];
  let wrongLeft = wrongAnswers;
  for (const cell of findPath(state.maze, state.player, state.exit).slice(1)) {
    const dir = DIRECTIONS.find((d) => {
      const next = stepFrom(state.player, d);
      return next.row === cell.row && next.col === cell.col;
    });
    assert.ok(dir);
    actions.push(dir);
    state = move(state, dir);
    if (state.challenge === null) continue;
    if (wrongLeft > 0) {
      wrongLeft--;
      actions.push({ answer: 0 });
      state = answer(state, 0);
    }
    actions.push({ answer: cell.row * cell.col });
    state = answer(state, cell.row * cell.col);
  }
  assert.ok(state.finished);
  return actions;
}
