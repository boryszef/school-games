import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import { registerGame } from "../src/core/registry.js";
import { emptyData } from "../src/core/storage.js";
import coreEn from "../src/i18n/en.js";
import { renderHome } from "../src/screens/home.js";

/** @type {ReturnType<typeof installDom>} */
let dom;
beforeEach(() => {
  dom = installDom();
});

/**
 * @param {string} id
 * @param {"math" | "languages"} subject
 */
function registerStub(id, subject) {
  registerGame({
    id,
    titleKey: "home.title",
    icon: "?",
    subject,
    messages: { pl: {}, en: {} },
    mount: () => () => {},
  });
}

function render() {
  const root = dom.document.createElement("main");
  /** @type {import("../src/core/app.js").App} */
  const app = {
    data: { ...emptyData(), lang: "en" },
    t: (key, params) => translate(coreEn, key, params),
    update: () => {},
    navigate: () => {},
    refresh: () => {},
    returnHash: null,
  };
  renderHome(root, app, { name: "home" });
  return root;
}

/** @param {HTMLElement} root */
function groups(root) {
  return [...root.querySelectorAll(".game-group")].map((group) => ({
    heading: group.querySelector("h2")?.textContent,
    games: [...group.querySelectorAll(".game-tile")].map((tile) => tile.getAttribute("href")),
  }));
}

test("the home screen shows math games and language games in separate groups", () => {
  registerStub("words", "languages");
  registerStub("sums", "math");
  registerStub("times", "math");

  assert.deepEqual(groups(render()), [
    { heading: "🧮 Math", games: ["#/game/sums", "#/game/times"] },
    { heading: "🌍 Foreign languages", games: ["#/game/words"] },
  ]);
});
