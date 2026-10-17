import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import { emptyData } from "../src/core/storage.js";
import coreEn from "../src/i18n/en.js";

// The screen talks to the Worker, whose address depends on the page's host.
Object.assign(globalThis, { location: new URL("http://localhost:8000/") });
const { renderPlayers } = await import("../src/screens/players.js");
const { registerGame } = await import("../src/core/registry.js");
const { robotMaze } = await import("../src/games/robot-maze/index.js");
const { messages: mazeMessages } = await import("../src/games/robot-maze/i18n.js");
registerGame(robotMaze);

/** @type {ReturnType<typeof installDom>} */
let dom;
beforeEach(() => {
  dom = installDom();
});

/** @param {import("../src/core/storage.js").AppData} data */
function render(data) {
  const root = dom.document.createElement("main");
  /** @type {import("../src/core/app.js").App} */
  const app = {
    data,
    t: (key, params) => translate({ ...coreEn, ...mazeMessages.en }, key, params),
    update: () => {},
    navigate: () => {},
    refresh: () => {},
    returnHash: null,
  };
  renderPlayers(root, app, { name: "players" });
  return root;
}

/** @param {HTMLElement} root */
const newPlayerButton = (root) =>
  [...root.querySelectorAll("button")].find((b) => b.textContent?.includes("New player"));

test("without a player, the screen offers to create one", () => {
  const root = render({ ...emptyData(), lang: "en" });
  assert.ok(newPlayerButton(root), "no New player button");
});

test("with a player, there is no way to add or switch players", () => {
  const player = { name: "RedFox1", createdAt: "x" };
  const root = render({ ...emptyData(), lang: "en", player });
  assert.equal(newPlayerButton(root), undefined);
  assert.equal(root.querySelector(".player-list"), null);
  assert.equal(root.querySelector(".player-stats h2")?.textContent, "RedFox1");
});

test("the stats show the best time and no list of mistakes", () => {
  const player = { name: "RedFox1", createdAt: "x" };
  const runs = [{ gameId: "robot-maze", finishedAt: "x", timeMs: 65_000, penaltyMs: 5000 }];
  const root = render({ ...emptyData(), lang: "en", player, runs });
  const text = root.querySelector(".player-stats")?.textContent ?? "";
  assert.ok(text.includes("Best time: 1:05.0"), text);
  assert.ok(!text.includes("Most missed"), text);
});
