import { canMove, generateMaze, stepFrom } from "./maze.js";
import { findPath, positionKey } from "./path.js";
import { placeRobots } from "./robots.js";

/** @typedef {import("./maze.js").Maze} Maze */
/** @typedef {import("./maze.js").Position} Position */
/** @typedef {import("./maze.js").Direction} Direction */
/** @typedef {import("../../core/random.js").Rng} Rng */
/** @typedef {Position & {active: boolean}} Robot */
/**
 * @typedef {object} GameState
 * @property {Maze} maze
 * @property {Position} player
 * @property {Position} exit
 * @property {Robot[]} robots
 * @property {Position | null} challenge Robot cell whose product must be typed in.
 * @property {number} penaltyMs
 * @property {[number, number][]} mistakes `[row, col]` of each wrong answer.
 * @property {boolean} finished
 */
/** @typedef {{size: number, robotCount: number, rng: Rng}} GameConfig */

export const PENALTY_MS = 5000;

/**
 * @param {GameConfig} config
 * @returns {GameState}
 */
export function createGame({ size, robotCount, rng }) {
  const maze = generateMaze(size, rng);
  const player = { row: 1, col: 1 };
  const exit = { row: size, col: size };
  const robots = placeRobots(findPath(maze, player, exit), robotCount, rng);
  return {
    maze,
    player,
    exit,
    robots: robots.map((pos) => ({ ...pos, active: true })),
    challenge: null,
    penaltyMs: 0,
    mistakes: [],
    finished: false,
  };
}

/**
 * Moves the player, or opens a challenge when an active robot blocks the way.
 * Ignored through walls, while a challenge is open, and after the finish.
 * @param {GameState} state
 * @param {Direction} dir
 * @returns {GameState}
 */
export function move(state, dir) {
  if (state.finished || state.challenge || !canMove(state.maze, state.player, dir)) return state;
  const target = stepFrom(state.player, dir);
  const blocked = state.robots.some((r) => r.active && positionKey(r) === positionKey(target));
  return blocked ? { ...state, challenge: target } : _enter(state, target);
}

/**
 * @param {GameState} state
 * @param {number} value
 * @returns {GameState}
 */
export function answer(state, value) {
  const challenge = state.challenge;
  if (!challenge) return state;
  if (value !== challenge.row * challenge.col) {
    return {
      ...state,
      penaltyMs: state.penaltyMs + PENALTY_MS,
      mistakes: [...state.mistakes, [challenge.row, challenge.col]],
    };
  }
  const robots = state.robots.map((r) =>
    positionKey(r) === positionKey(challenge) ? { ...r, active: false } : r,
  );
  return _enter({ ...state, robots, challenge: null }, challenge);
}

/**
 * @param {GameState} state
 * @param {Position} target
 * @returns {GameState}
 */
function _enter(state, target) {
  return { ...state, player: target, finished: positionKey(target) === positionKey(state.exit) };
}
