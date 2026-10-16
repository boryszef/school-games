import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import { messages } from "../src/games/tug-of-war/i18n.js";
import { createResultPanel } from "../src/games/tug-of-war/result.js";
import coreEn from "../src/i18n/en.js";

/** @type {import("../src/core/i18n.js").Translate} */
const t = (key, params) => translate({ ...coreEn, ...messages.en }, key, params);

/** @type {ReturnType<typeof installDom>} */
let dom;
beforeEach(() => {
  dom = installDom();
});

/** @param {boolean} host */
function panel(host) {
  const prompt = dom.document.createElement("div");
  prompt.className = "lb-submit";
  const result = createResultPanel(t, {
    won: host,
    opponentName: "BlueOwl7",
    onPlayAgain: host ? () => {} : null,
    onHome: () => {},
    submission: prompt,
  });
  /** @param {string} text */
  const has = (text) => result.element.textContent?.includes(text) ?? false;
  return { result, prompt, has };
}

test("when the friend leaves, the host can no longer play again but keeps the rest", () => {
  const { result, prompt, has } = panel(true);
  assert.ok(has("Play again"));
  result.opponentLeft();

  assert.ok(!has("Play again"));
  assert.ok(has("Your friend has left."));
  assert.ok(has("You won!"));
  assert.ok(has("Choose another game"));
  assert.ok(result.element.contains(prompt));
});

test("when the host leaves, the guest stops waiting but keeps the rest", () => {
  const { result, prompt, has } = panel(false);
  assert.ok(has("Waiting for BlueOwl7"));
  result.opponentLeft();

  assert.ok(!has("Waiting for BlueOwl7"));
  assert.ok(has("Your friend has left."));
  assert.ok(has("BlueOwl7 won"));
  assert.ok(has("Choose another game"));
  assert.ok(result.element.contains(prompt));
});
