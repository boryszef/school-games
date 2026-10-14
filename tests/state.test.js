import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/random.js";
import { DIRECTIONS, canMove, stepFrom } from "../src/games/robot-maze/maze.js";
import { findPath } from "../src/games/robot-maze/path.js";
import { PENALTY_MS, answer, createGame, move } from "../src/games/robot-maze/state.js";

/** @typedef {import("../src/games/robot-maze/state.js").GameState} GameState */
/** @typedef {import("../src/games/robot-maze/maze.js").Position} Position */

const newGame = (seed = 21) => createGame({ size: 10, robotCount: 10, rng: createRng(seed) });

/**
 * @param {GameState} state
 * @param {Position} target
 */
function directionTo(state, target) {
  const dir = DIRECTIONS.find((d) => {
    const next = stepFrom(state.player, d);
    return next.row === target.row && next.col === target.col;
  });
  assert.ok(dir, "target is not adjacent");
  return dir;
}

/** Walks the solution path until the next step hits an active robot. */
function walkToFirstRobot() {
  let state = newGame();
  const path = findPath(state.maze, state.player, state.exit);
  for (const cell of path.slice(1)) {
    const next = move(state, directionTo(state, cell));
    if (next.challenge) return next;
    state = next;
  }
  throw new Error("no robot on the path");
}

test("a new game starts at (1,1) with the exit at (10,10) and 10 active robots", () => {
  const state = newGame();
  assert.deepEqual(state.player, { row: 1, col: 1 });
  assert.deepEqual(state.exit, { row: 10, col: 10 });
  assert.equal(state.robots.length, 10);
  assert.ok(state.robots.every((r) => r.active));
  assert.equal(state.challenge, null);
  assert.equal(state.penaltyMs, 0);
  assert.deepEqual(state.mistakes, []);
  assert.equal(state.finished, false);
});

test("moving into a wall leaves the player in place", () => {
  const state = newGame();
  const walled = DIRECTIONS.find((d) => !canMove(state.maze, state.player, d));
  assert.ok(walled);
  assert.deepEqual(move(state, walled).player, state.player);
});

test("moving through an open passage without a robot moves the player", () => {
  const state = newGame(1); // seed 1: the start has a robot-free open neighbour
  const robotKeys = new Set(state.robots.map((r) => `${r.row},${r.col}`));
  const free = DIRECTIONS.find((d) => {
    const next = stepFrom(state.player, d);
    return canMove(state.maze, state.player, d) && !robotKeys.has(`${next.row},${next.col}`);
  });
  assert.ok(free, "seed should give a robot-free first step");
  assert.deepEqual(move(state, free).player, stepFrom(state.player, free));
});

test("moving into an active robot opens a challenge and keeps the player in place", () => {
  const state = walkToFirstRobot();
  assert.ok(state.challenge);
  const robot = state.robots.find(
    (r) => r.row === state.challenge?.row && r.col === state.challenge?.col,
  );
  assert.ok(robot?.active);
  assert.notDeepEqual(state.player, { row: state.challenge.row, col: state.challenge.col });
});

test("a wrong answer adds the penalty, records the mistake and keeps the challenge", () => {
  const state = walkToFirstRobot();
  const { row, col } = /** @type {Position} */ (state.challenge);
  const after = answer(state, row * col + 1);

  assert.equal(PENALTY_MS, 5000);
  assert.equal(after.penaltyMs, PENALTY_MS);
  assert.deepEqual(after.mistakes, [[row, col]]);
  assert.deepEqual(after.challenge, state.challenge);
  assert.deepEqual(after.player, state.player);
});

test("a correct answer disables the robot and moves the player into its cell", () => {
  const state = walkToFirstRobot();
  const { row, col } = /** @type {Position} */ (state.challenge);
  const after = answer(state, row * col);

  assert.equal(after.challenge, null);
  assert.deepEqual(after.player, { row, col });
  assert.equal(after.robots.find((r) => r.row === row && r.col === col)?.active, false);
  assert.equal(after.penaltyMs, 0);
});

test("solving every robot on the path and reaching the exit finishes the game", () => {
  let state = newGame();
  const path = findPath(state.maze, state.player, state.exit);
  for (const cell of path.slice(1)) {
    state = move(state, directionTo(state, cell));
    if (state.challenge) state = answer(state, state.challenge.row * state.challenge.col);
  }
  assert.deepEqual(state.player, state.exit);
  assert.equal(state.finished, true);
  assert.ok(state.robots.every((r) => !r.active));
});
