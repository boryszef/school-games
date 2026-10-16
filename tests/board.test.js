import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { createRng } from "../src/core/random.js";
import { createBoard } from "../src/games/robot-maze/board.js";
import { DIRECTIONS, stepFrom } from "../src/games/robot-maze/maze.js";
import { findPath, positionKey } from "../src/games/robot-maze/path.js";
import { STANDARD_GAME, answer, createGame, move } from "../src/games/robot-maze/state.js";

/** @typedef {import("../src/games/robot-maze/state.js").GameState} GameState */
/** @typedef {import("../src/games/robot-maze/maze.js").Position} Position */

beforeEach(() => {
  installDom();
});

/**
 * Plays the solution path until `robotsToBeat` robots are beaten and the player has moved on.
 * @param {number} robotsToBeat
 */
function playUntilBeaten(robotsToBeat) {
  let state = createGame({ ...STANDARD_GAME, rng: createRng(21) });
  /** @type {Position[]} */
  const beaten = [];
  for (const cell of findPath(state.maze, state.player, state.exit).slice(1)) {
    if (beaten.length === robotsToBeat) break;
    const dir = DIRECTIONS.find(
      (d) => positionKey(stepFrom(state.player, d)) === positionKey(cell),
    );
    state = move(state, /** @type {import("../src/games/robot-maze/maze.js").Direction} */ (dir));
    if (state.challenge === null) continue;
    state = answer(state, cell.row * cell.col);
    beaten.push(cell);
  }
  return { state, beaten };
}

/**
 * @param {GameState} state
 * @param {Position} pos
 */
function cellText(state, pos) {
  const board = createBoard(state.maze, () => {});
  board.update(state);
  const cells = board.element.querySelectorAll(".rm-cell");
  const cell = cells[(pos.row - 1) * state.maze.size + (pos.col - 1)];
  return { text: cell.textContent, disabled: cell.classList.contains("is-disabled-robot") };
}

test("an active robot shows the robot", () => {
  const { state } = playUntilBeaten(0);
  const robot = state.robots[0];
  assert.deepEqual(cellText(state, robot), { text: "🤖", disabled: false });
});

test("a beaten robot shows its product once the player has moved on", () => {
  const { state, beaten } = playUntilBeaten(2);
  const first = beaten[0];
  assert.notEqual(positionKey(state.player), positionKey(first));
  assert.deepEqual(cellText(state, first), {
    text: String(first.row * first.col),
    disabled: true,
  });
});

test("the player is shown while standing on a beaten robot", () => {
  const { state, beaten } = playUntilBeaten(1);
  const last = beaten[0];
  assert.equal(positionKey(state.player), positionKey(last));
  assert.equal(cellText(state, last).text, "🧒");
});
