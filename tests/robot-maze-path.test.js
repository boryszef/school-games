import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/random.js";
import { DIRECTIONS, canMove, generateMaze, stepFrom } from "../src/games/robot-maze/maze.js";
import { findPath } from "../src/games/robot-maze/path.js";

const START = { row: 1, col: 1 };
const EXIT = { row: 10, col: 10 };

test("path leads from start to exit through open passages without revisiting cells", () => {
  const maze = generateMaze(10, createRng(7));
  const path = findPath(maze, START, EXIT);

  assert.deepEqual(path[0], START);
  assert.deepEqual(path.at(-1), EXIT);
  for (let i = 1; i < path.length; i++) {
    const legal = DIRECTIONS.some(
      (dir) =>
        canMove(maze, path[i - 1], dir) &&
        JSON.stringify(stepFrom(path[i - 1], dir)) === JSON.stringify(path[i]),
    );
    assert.ok(legal, `illegal step ${JSON.stringify(path[i - 1])} -> ${JSON.stringify(path[i])}`);
  }
  assert.equal(new Set(path.map((p) => `${p.row},${p.col}`)).size, path.length);
});

test("path from start to exit of a 10×10 maze has at least 19 cells", () => {
  const maze = generateMaze(10, createRng(8));
  assert.ok(findPath(maze, START, EXIT).length >= 19);
});

test("path from a cell to itself is that single cell", () => {
  const maze = generateMaze(10, createRng(9));
  assert.deepEqual(findPath(maze, START, START), [START]);
});
