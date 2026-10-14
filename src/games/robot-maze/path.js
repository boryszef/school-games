import { DIRECTIONS, canMove, stepFrom } from "./maze.js";

/** @typedef {import("./maze.js").Maze} Maze */
/** @typedef {import("./maze.js").Position} Position */

/** @param {Position} pos */
export const positionKey = (pos) => `${pos.row},${pos.col}`;

/**
 * Shortest route between two cells (breadth-first search), both ends included.
 * @param {Maze} maze
 * @param {Position} from
 * @param {Position} to
 * @returns {Position[]}
 */
export function findPath(maze, from, to) {
  /** @type {Map<string, Position | null>} */
  const parents = new Map([[positionKey(from), null]]);
  const queue = [from];

  while (queue.length > 0) {
    const pos = /** @type {Position} */ (queue.shift());
    if (positionKey(pos) === positionKey(to)) break;
    for (const dir of DIRECTIONS) {
      const next = stepFrom(pos, dir);
      if (canMove(maze, pos, dir) && !parents.has(positionKey(next))) {
        parents.set(positionKey(next), pos);
        queue.push(next);
      }
    }
  }

  const path = [];
  for (
    let pos = /** @type {Position | null | undefined} */ (to);
    pos;
    pos = parents.get(positionKey(pos))
  ) {
    path.unshift(pos);
  }
  return path;
}
