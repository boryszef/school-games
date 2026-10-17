import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { gameContext, goOffline, routeFetchToWorker, until } from "./helpers/game-online.js";
import { solveActions } from "./helpers/maze-solver.js";
import { createRng } from "../src/core/random.js";
import { DIRECTIONS, canMove, stepFrom } from "../src/games/robot-maze/maze.js";
import { LEVELS, createGame } from "../src/games/robot-maze/state.js";
import { workerSetup } from "./helpers/worker.js";

const { messages } = await import("../src/games/robot-maze/i18n.js");
const { robotMaze } = await import("../src/games/robot-maze/index.js");

/** @type {Record<string, string>} */
const KEYS = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

/** @type {ReturnType<typeof installDom>} */
let dom;
/** Stops the game's clock and key listeners, which would keep the test run alive. */
let unmount = () => {};
beforeEach(() => {
  dom = installDom();
});
afterEach(() => unmount());

/**
 * Plays the recorded actions through the keyboard and the challenge dialog.
 * @param {HTMLElement} root
 * @param {import("./helpers/maze-solver.js").Action[]} actions
 */
function play(root, actions) {
  for (const action of actions) {
    if (typeof action === "string") {
      dom.dispatchEvent(new dom.KeyboardEvent("keydown", { key: KEYS[action] }));
      continue;
    }
    const input = /** @type {HTMLInputElement} */ (root.querySelector(".rm-answer"));
    input.value = String(action.answer);
    root
      .querySelector("form.overlay-card")
      ?.dispatchEvent(new dom.Event("submit", { cancelable: true }));
  }
}

/** @param {HTMLElement} root */
const boardShown = (root) => () => root.querySelector(".rm-board") !== null;

/** @param {HTMLElement} root */
const resultCard = (root) =>
  /** @type {HTMLElement} */ ([...root.querySelectorAll(".overlay-card")].at(-1));

test("a registered player's maze is timed by the Worker and added to the leaderboard", async () => {
  const worker = workerSetup();
  const exchanges = routeFetchToWorker(worker);
  const player = await worker.newPlayer();
  const root = dom.document.createElement("main");
  const ctx = gameContext(messages.en, { name: player.nickname, account: player });
  unmount = robotMaze.mount(root, ctx);
  assert.equal(root.textContent, "Preparing the maze…");
  await until(boardShown(root));
  assert.deepEqual(
    exchanges.map((e) => [e.method, e.path, e.body]),
    [["POST", "/maze-runs", { level: "standard" }]],
  );

  worker.advance(42_000);
  play(root, solveActions(exchanges[0].data.seed, { wrongAnswers: 1 }));
  await until(() => !resultCard(root).textContent?.includes("Sending…"));
  const card = resultCard(root).textContent ?? "";
  assert.match(card, /^Well done, you made it!Your time: \d:\d\d\.\dMistakes: 1New record! 🏆/);
  assert.match(card, /Added! Leaderboard time: 0:47\.0Play againChoose another game$/);
  assert.equal(exchanges[1].path, `/maze-runs/${exchanges[0].data.runId}/finish`);
  const board = await (await worker.call("GET", "/leaderboard")).json();
  assert.deepEqual(board.maze.allTime, [{ nickname: player.nickname, timeMs: 47_000 }]);

  const home = [...resultCard(root).querySelectorAll("button")].at(-1);
  /** @type {HTMLElement} */ (home).click();
  assert.equal(ctx.exited, true);
});

test("offline, the maze is played but nothing is sent", async () => {
  goOffline();
  const root = dom.document.createElement("main");
  const ctx = gameContext(messages.en, { name: "Tester", account: { id: "p1", token: "secret" } });
  unmount = robotMaze.mount(root, ctx);
  await until(boardShown(root));
  assert.ok(root.querySelector(".rm-board"));
  assert.equal(root.querySelector(".lb-submit"), null);
});

test("the player moves by tapping a neighbouring cell, with no on-screen pad", async () => {
  const worker = workerSetup();
  const exchanges = routeFetchToWorker(worker);
  const player = await worker.newPlayer();
  const root = dom.document.createElement("main");
  unmount = robotMaze.mount(
    root,
    gameContext(messages.en, { name: player.nickname, account: player }),
  );
  await until(boardShown(root));
  assert.equal(root.querySelector(".dpad"), null);

  // The same maze the game built from the Worker's seed: find an open step without a robot.
  const game = createGame({ ...LEVELS.standard, rng: createRng(exchanges[0].data.seed) });
  const target = DIRECTIONS.filter((dir) => canMove(game.maze, game.player, dir))
    .map((dir) => stepFrom(game.player, dir))
    .find((pos) => !game.robots.some((r) => r.row === pos.row && r.col === pos.col));
  assert.ok(target, "the start has no free neighbour");
  // Cells follow a row of column numbers; each row starts with its row number.
  const size = game.maze.size;
  const cell = root.querySelector(".rm-board")?.children[(size + 1) * target.row + target.col];
  /** @type {HTMLElement} */ (cell).click();
  assert.equal(cell?.textContent, "🧒");
});
