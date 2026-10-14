import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/random.js";
import { DIRECTIONS, canMove, generateMaze, stepFrom } from "../src/games/robot-maze/maze.js";

const SIZE = 10;

/** @returns {import("../src/games/robot-maze/maze.js").Position[]} */
function allCells() {
  const cells = [];
  for (let row = 1; row <= SIZE; row++) {
    for (let col = 1; col <= SIZE; col++) cells.push({ row, col });
  }
  return cells;
}

test("every cell is reachable from the start", () => {
  const maze = generateMaze(SIZE, createRng(1));
  const seen = new Set(["1,1"]);
  const queue = [{ row: 1, col: 1 }];
  while (queue.length > 0) {
    const pos = /** @type {import("../src/games/robot-maze/maze.js").Position} */ (queue.shift());
    for (const dir of DIRECTIONS) {
      if (!canMove(maze, pos, dir)) continue;
      const next = stepFrom(pos, dir);
      const key = `${next.row},${next.col}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  assert.equal(seen.size, SIZE * SIZE);
});

test("maze is perfect: exactly size² - 1 passages (no loops)", () => {
  const maze = generateMaze(SIZE, createRng(2));
  const passages =
    allCells().filter((p) => canMove(maze, p, "right")).length +
    allCells().filter((p) => canMove(maze, p, "down")).length;
  assert.equal(passages, SIZE * SIZE - 1);
});

test("passages are symmetric between neighbours", () => {
  const maze = generateMaze(SIZE, createRng(3));
  for (const pos of allCells()) {
    if (pos.col < SIZE) {
      assert.equal(canMove(maze, pos, "right"), canMove(maze, stepFrom(pos, "right"), "left"));
    }
    if (pos.row < SIZE) {
      assert.equal(canMove(maze, pos, "down"), canMove(maze, stepFrom(pos, "down"), "up"));
    }
  }
});

test("the outer border is always closed", () => {
  const maze = generateMaze(SIZE, createRng(4));
  for (let i = 1; i <= SIZE; i++) {
    assert.equal(canMove(maze, { row: 1, col: i }, "up"), false);
    assert.equal(canMove(maze, { row: SIZE, col: i }, "down"), false);
    assert.equal(canMove(maze, { row: i, col: 1 }, "left"), false);
    assert.equal(canMove(maze, { row: i, col: SIZE }, "right"), false);
  }
});

test("the same seed produces the same maze, different seeds differ", () => {
  /** @param {number} seed */
  const signature = (seed) => {
    const maze = generateMaze(SIZE, createRng(seed));
    return allCells()
      .map((p) => DIRECTIONS.map((d) => (canMove(maze, p, d) ? "1" : "0")).join(""))
      .join("");
  };
  assert.equal(signature(42), signature(42));
  assert.notEqual(signature(42), signature(43));
});

test("a 1×1 maze has no passages", () => {
  const maze = generateMaze(1, createRng(5));
  for (const dir of DIRECTIONS) assert.equal(canMove(maze, { row: 1, col: 1 }, dir), false);
});
