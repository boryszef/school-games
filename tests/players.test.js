import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import { emptyData } from "../src/core/storage.js";
import coreEn from "../src/i18n/en.js";

// The screen talks to the Worker, whose address depends on the page's host.
Object.assign(globalThis, { location: new URL("http://localhost:8000/") });
const { renderPlayers } = await import("../src/screens/players.js");

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
    t: (key, params) => translate(coreEn, key, params),
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
