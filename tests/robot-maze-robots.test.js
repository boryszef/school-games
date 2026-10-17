import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/random.js";
import { generateMaze } from "../src/games/robot-maze/maze.js";
import { findPath } from "../src/games/robot-maze/path.js";
import { placeRobots } from "../src/games/robot-maze/robots.js";

/** @param {{row: number, col: number}} p */
const key = (p) => `${p.row},${p.col}`;

test("places the requested number of robots on distinct inner path cells", () => {
  const path = findPath(generateMaze(10, createRng(11)), { row: 1, col: 1 }, { row: 10, col: 10 });
  const robots = placeRobots(path, 10, createRng(12));

  assert.equal(robots.length, 10);
  assert.equal(new Set(robots.map(key)).size, 10);
  const inner = new Set(path.slice(1, -1).map(key));
  for (const robot of robots) assert.ok(inner.has(key(robot)), `${key(robot)} not on inner path`);
});

test("uses every inner cell when the count equals the inner path length", () => {
  const path = [1, 2, 3, 4, 5].map((col) => ({ row: 1, col }));
  const robots = placeRobots(path, 3, createRng(13));
  assert.deepEqual(robots.map(key).sort(), ["1,2", "1,3", "1,4"]);
});
