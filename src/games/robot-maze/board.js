import { h } from "../../core/ui/dom.js";
import { DIRECTIONS, canMove } from "./maze.js";
import { positionKey } from "./path.js";

/** @typedef {import("./maze.js").Maze} Maze */
/** @typedef {import("./maze.js").Position} Position */
/** @typedef {import("./state.js").GameState} GameState */
/** @typedef {import("./state.js").Robot} Robot */

const PLAYER = "🧒";
const ROBOT = "🤖";
const EXIT = "🏁";

/**
 * Maze grid with the 1..size axes, like a multiplication table.
 * @param {Maze} maze
 * @param {(pos: Position) => void} onCellTap
 */
export function createBoard(maze, onCellTap) {
  /** @type {Map<string, HTMLElement>} */
  const cells = new Map();
  const board = h(
    "div",
    { class: "rm-board", style: `--size: ${maze.size}` },
    h("div", { class: "rm-axis" }, "×"),
  );

  for (let col = 1; col <= maze.size; col++)
    board.append(h("div", { class: "rm-axis" }, String(col)));
  for (let row = 1; row <= maze.size; row++) {
    board.append(h("div", { class: "rm-axis" }, String(row)));
    for (let col = 1; col <= maze.size; col++) {
      const pos = { row, col };
      const cell = h("div", { class: _cellClasses(maze, pos), onclick: () => onCellTap(pos) });
      cells.set(positionKey(pos), cell);
      board.append(cell);
    }
  }

  return {
    element: board,
    /** @param {GameState} state */
    update(state) {
      const robots = new Map(state.robots.map((r) => [positionKey(r), r]));
      const playerKey = positionKey(state.player);
      const exitKey = positionKey(state.exit);
      for (const [key, cell] of cells) {
        const robot = robots.get(key);
        cell.textContent =
          key === playerKey ? PLAYER : robot ? _robotFace(robot) : key === exitKey ? EXIT : "";
        cell.classList.toggle("is-disabled-robot", robot !== undefined && !robot.active);
        cell.classList.toggle(
          "is-challenged",
          state.challenge !== null && key === positionKey(state.challenge),
        );
      }
    },
  };
}

/**
 * A beaten robot shows the answer that beat it.
 * @param {Robot} robot
 */
function _robotFace(robot) {
  return robot.active ? ROBOT : String(robot.row * robot.col);
}

/**
 * @param {Maze} maze
 * @param {Position} pos
 */
function _cellClasses(maze, pos) {
  const walls = DIRECTIONS.filter((dir) => !canMove(maze, pos, dir)).map((dir) => `wall-${dir}`);
  return ["rm-cell", ...walls].join(" ");
}
