import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import coreEn from "../src/i18n/en.js";

// api.js picks the Worker's address from the page's host when imported.
Object.assign(globalThis, { location: new URL("http://localhost:8000/") });
const { ApiError } = await import("../src/core/online/api.js");
const { submitToLeaderboard } = await import("../src/core/ui/leaderboard-submit.js");

/** @type {import("../src/core/i18n.js").Translate} */
const t = (key, params) => translate(coreEn, key, params);

beforeEach(() => {
  installDom();
});

/** Lets the pending promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @param {HTMLElement} element */
const buttons = (element) => [...element.querySelectorAll("button")].map((b) => b.textContent);

test("the score is sent at once, without asking", async () => {
  let calls = 0;
  const element = submitToLeaderboard(t, async () => {
    calls++;
    return "Added! Leaderboard time: 1:05.0";
  });
  assert.equal(calls, 1);
  assert.equal(element.textContent, "Sending…");
  assert.deepEqual(buttons(element), []);

  await settle();
  assert.equal(element.textContent, "Added! Leaderboard time: 1:05.0");
});

test("without a line of its own, the status says Added!", async () => {
  const element = submitToLeaderboard(t, async () => null);
  await settle();
  assert.equal(element.textContent, "Added!");
});

test("a failed send can be tried again", async () => {
  let calls = 0;
  const element = submitToLeaderboard(t, async () => {
    calls++;
    if (calls === 1) throw new ApiError("POST /duels", 500);
    return null;
  });
  await settle();
  assert.ok(element.textContent?.includes("Could not send it."));
  assert.deepEqual(buttons(element), ["Try again"]);

  element.querySelector("button")?.click();
  assert.equal(calls, 2);
  await settle();
  assert.equal(element.textContent, "Added!");
  assert.deepEqual(buttons(element), []);
});
