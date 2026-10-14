import { log } from "../../core/log.js";

/** @typedef {import("./maze.js").Position} Position */
/** @typedef {import("../../core/random.js").Rng} Rng */

/**
 * Picks `count` distinct cells of the path, skipping its first and last cell.
 * @param {Position[]} path
 * @param {number} count
 * @param {Rng} rng
 * @returns {Position[]}
 */
export function placeRobots(path, count, rng) {
  const inner = path.slice(1, -1);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (inner.length - i));
    [inner[i], inner[j]] = [inner[j], inner[i]];
  }
  const robots = inner.slice(0, count);
  log.debug("robots placed", { pathLength: path.length, robots });
  return robots;
}
