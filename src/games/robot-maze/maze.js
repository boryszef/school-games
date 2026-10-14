import { log } from "../../core/log.js";

/** @typedef {import("../../core/random.js").Rng} Rng */
/** @typedef {{row: number, col: number}} Position 1-based, like the multiplication table. */
/** @typedef {"up" | "down" | "left" | "right"} Direction */
/** @typedef {{size: number, cells: Set<Direction>[]}} Maze `cells[i]` holds the open sides. */

/** @type {readonly Direction[]} */
export const DIRECTIONS = ["up", "down", "left", "right"];

/** @type {Record<Direction, [number, number]>} */
const OFFSETS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

/** @type {Record<Direction, Direction>} */
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

/**
 * @param {Position} pos
 * @param {Direction} dir
 * @returns {Position}
 */
export function stepFrom(pos, dir) {
  const [dRow, dCol] = OFFSETS[dir];
  return { row: pos.row + dRow, col: pos.col + dCol };
}

/**
 * @param {Maze} maze
 * @param {Position} pos
 * @param {Direction} dir
 */
export function canMove(maze, pos, dir) {
  return maze.cells[_indexOf(maze.size, pos)].has(dir);
}

/**
 * Perfect maze (every cell reachable, no loops) via randomized depth-first search.
 * @param {number} size
 * @param {Rng} rng
 * @returns {Maze}
 */
export function generateMaze(size, rng) {
  /** @type {Set<Direction>[]} */
  const cells = Array.from({ length: size * size }, () => new Set());
  const visited = new Set([0]);
  const stack = [{ row: 1, col: 1 }];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const options = DIRECTIONS.filter((dir) => {
      const next = stepFrom(current, dir);
      return _isInside(size, next) && !visited.has(_indexOf(size, next));
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const dir = options[Math.floor(rng() * options.length)];
    const next = stepFrom(current, dir);
    cells[_indexOf(size, current)].add(dir);
    cells[_indexOf(size, next)].add(OPPOSITE[dir]);
    visited.add(_indexOf(size, next));
    stack.push(next);
  }

  log.debug("maze generated", { size, visited: visited.size });
  return { size, cells };
}

/**
 * @param {number} size
 * @param {Position} pos
 */
function _isInside(size, pos) {
  return pos.row >= 1 && pos.row <= size && pos.col >= 1 && pos.col <= size;
}

/**
 * @param {number} size
 * @param {Position} pos
 */
function _indexOf(size, pos) {
  return (pos.row - 1) * size + (pos.col - 1);
}
