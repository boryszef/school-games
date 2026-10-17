import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import {
  fakeClock,
  gameContext,
  goOffline,
  routeFetchToWorker,
  until,
} from "./helpers/game-online.js";
import { workerSetup } from "./helpers/worker.js";

const { COLORS, COLOR_NAMES } = await import("../src/games/color-invasion/colors.js");
const { messages } = await import("../src/games/color-invasion/i18n.js");
const { colorInvasion } = await import("../src/games/color-invasion/index.js");

/** @type {ReturnType<typeof installDom>} */
let dom;
/** Stops the game's clock and key listeners, which would keep the test run alive. */
let unmount = () => {};
beforeEach(() => {
  dom = installDom();
});
afterEach(() => unmount());

/**
 * @param {HTMLElement} root
 * @param {string} selector
 */
const one = (root, selector) => /** @type {HTMLElement} */ (root.querySelector(selector));

/** @param {HTMLElement} root */
function startSpanish(root) {
  const buttons = [...root.querySelectorAll(".ci-language")];
  /** @type {HTMLElement} */ (buttons.find((b) => b.textContent === "Español")).click();
}

/**
 * Shoots at the column of the color named on screen, or at another one.
 * @param {HTMLElement} root
 * @param {boolean} aim
 */
function shootAt(root, aim) {
  const word = one(root, ".ci-word").textContent;
  const id = Object.keys(COLOR_NAMES.es).find((key) => COLOR_NAMES.es[key] === word);
  const probe = dom.document.createElement("div");
  probe.style.background = /** @type {{css: string}} */ (COLORS.find((c) => c.id === id)).css;
  const columns = [...root.querySelectorAll(".ci-column")];
  const column = columns.find(
    (c) =>
      (one(/** @type {HTMLElement} */ (c), ".ci-box").style.background ===
        probe.style.background) ===
      aim,
  );
  /** @type {HTMLElement} */ (column).click();
  one(root, ".ci-shoot").click();
}

/** @param {HTMLElement} root */
const cardText = (root) => one(root, ".ci-card").textContent;

/** @param {HTMLElement} root */
const boardShown = (root) => () => root.querySelector(".ci-board") !== null;

/** The card is shown, and a score being sent has had its answer. */
const roundOver = (/** @type {HTMLElement} */ root) => () =>
  root.querySelector(".ci-card") !== null && !cardText(root).includes("Sending…");

test("a registered player's round is checked by the Worker and added to the leaderboard", async () => {
  const clock = fakeClock();
  const worker = workerSetup();
  const exchanges = routeFetchToWorker(worker);
  const player = await worker.newPlayer();
  const root = dom.document.createElement("main");
  const ctx = gameContext(messages.en, { name: player.nickname, account: player });
  unmount = colorInvasion.mount(root, ctx);

  startSpanish(root);
  assert.equal(root.textContent, "Preparing the game…");
  await until(boardShown(root));
  assert.deepEqual(
    exchanges.map((e) => [e.method, e.path, e.body]),
    [["POST", "/color-runs", { lang: "es" }]],
  );
  for (const aim of [true, true, true, false]) shootAt(root, aim);
  assert.equal(one(root, ".ci-score").textContent, "Points: 2");

  clock.advance(60_000);
  worker.advance(60_000);
  await until(roundOver(root));
  assert.equal(
    cardText(root),
    "Time's up!Your score: 2Hits: 3Mistakes: 1Columns cleared: 0Added!Play againChoose another game",
  );
  const finish = exchanges[1];
  assert.equal(finish.path, `/color-runs/${exchanges[0].data.runId}/finish`);
  assert.deepEqual(finish.data, { score: 2 });
  const board = await (await worker.call("GET", "/leaderboard")).json();
  assert.deepEqual(board.colors.es.allTime, [{ nickname: player.nickname, score: 2 }]);
});

test("the result card's buttons start a new round or leave the game", async () => {
  const clock = fakeClock();
  goOffline();
  const root = dom.document.createElement("main");
  const ctx = gameContext(messages.en, { name: "Tester", account: null });
  unmount = colorInvasion.mount(root, ctx);
  startSpanish(root);
  await until(boardShown(root));
  clock.advance(60_000);
  await until(roundOver(root));

  const [playAgain, home] = /** @type {HTMLElement[]} */ ([
    ...root.querySelectorAll(".ci-card button"),
  ]);
  home.click();
  assert.equal(ctx.exited, true);
  playAgain.click();
  await until(boardShown(root));
  assert.equal(root.querySelector(".ci-card"), null);
  assert.equal(one(root, ".ci-score").textContent, "Points: 0");
});

test("offline, the round is played but nothing is sent", async () => {
  const clock = fakeClock();
  goOffline();
  const root = dom.document.createElement("main");
  unmount = colorInvasion.mount(root, gameContext(messages.en, { name: "Tester", account: null }));
  startSpanish(root);
  await until(boardShown(root));
  shootAt(root, true);
  clock.advance(60_000);
  await until(roundOver(root));
  assert.equal(
    cardText(root),
    "Time's up!Your score: 1Hits: 1Mistakes: 0Columns cleared: 0Play againChoose another game",
  );
});

test("when the Worker can't be reached at the start, the round is played locally", async () => {
  const clock = fakeClock();
  goOffline();
  const root = dom.document.createElement("main");
  const account = { id: "p1", token: "secret" };
  unmount = colorInvasion.mount(root, gameContext(messages.en, { name: "Tester", account }));
  startSpanish(root);
  await until(boardShown(root));
  assert.ok(root.querySelector(".ci-board"));
  clock.advance(60_000);
  await until(roundOver(root));
  assert.ok(!cardText(root).includes("Added!"));
});
