import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import { FREEZE_MS, createQuestionCard } from "../src/games/tug-of-war/question.js";
import { messages } from "../src/games/tug-of-war/i18n.js";
import coreEn from "../src/i18n/en.js";

/** @typedef {{value: number, reactionMs: number}} Correct */

/** @type {import("../src/core/i18n.js").Translate} */
const t = (key, params) => translate({ ...coreEn, ...messages.en }, key, params);

/** @type {ReturnType<typeof installDom>} */
let dom;
let clockMs = 0;
beforeEach(() => {
  dom = installDom();
  clockMs = 0;
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
});
afterEach(() => {
  mock.timers.reset();
});

/** Advances both the card's clock and the mocked timers. */
function wait(/** @type {number} */ ms) {
  clockMs += ms;
  mock.timers.tick(ms);
}

function openCard() {
  /** @type {Correct[]} */
  const correct = [];
  const card = createQuestionCard(
    t,
    (answer) => correct.push(answer),
    () => clockMs,
  );
  dom.document.body.append(card.element);
  const form = /** @type {HTMLFormElement} */ (card.element.querySelector("form"));
  const input = /** @type {HTMLInputElement} */ (card.element.querySelector("input"));
  /** @param {string} value */
  const submit = (value) => {
    input.value = value;
    form.requestSubmit();
  };
  return { card, form, input, submit, correct };
}

test("show asks the question", () => {
  const { card } = openCard();
  card.show({ a: 7, b: 8 });
  assert.equal(card.element.querySelector(".tw-question")?.textContent, "7 × 8 = ?");
});

test("a correct answer reports the reaction time since the question was shown", () => {
  const { card, submit, correct } = openCard();
  wait(5000);
  card.show({ a: 7, b: 8 });
  wait(1800);
  submit("56");
  assert.deepEqual(correct, [{ value: 56, reactionMs: 1800 }]);
});

test("after a correct answer the card waits for the next question", () => {
  const { card, submit, correct, input } = openCard();
  card.show({ a: 3, b: 4 });
  submit("12");
  submit("12");
  assert.equal(correct.length, 1);
  assert.equal(input.disabled, true);
});

test("a correct answer clears the question at once, until the next one", () => {
  const { card, input, submit } = openCard();
  card.show({ a: 7, b: 8 });
  submit("56");
  assert.equal(card.element.querySelector(".tw-question")?.textContent, "");
  assert.equal(input.value, "");
  assert.equal(card.element.querySelector(".tw-feedback")?.textContent, "Correct!");

  card.show({ a: 3, b: 9 });
  assert.equal(card.element.querySelector(".tw-question")?.textContent, "3 × 9 = ?");
  assert.equal(card.element.querySelector(".tw-feedback")?.textContent, "");
});

test("a wrong answer shakes the card and freezes it", () => {
  const { card, form, input, submit, correct } = openCard();
  card.show({ a: 6, b: 7 });
  submit("41");
  assert.ok(form.classList.contains("shake"));
  assert.equal(card.element.querySelector(".tw-feedback")?.textContent, "Not quite! Wait 2 s");
  assert.equal(input.disabled, true);
  submit("42");
  assert.deepEqual(correct, []);
});

test("after the freeze the player can answer again, and the freeze counts as time", () => {
  const { card, input, submit, correct } = openCard();
  card.show({ a: 6, b: 7 });
  wait(1000);
  submit("41");
  wait(FREEZE_MS);
  assert.equal(input.disabled, false);
  wait(500);
  submit("42");
  assert.deepEqual(correct, [{ value: 42, reactionMs: 1000 + FREEZE_MS + 500 }]);
});

test("a new question ends the freeze and clears the shake", () => {
  const { card, form, input, submit } = openCard();
  card.show({ a: 6, b: 7 });
  submit("41");
  card.show({ a: 9, b: 9 });
  assert.equal(form.classList.contains("shake"), false);
  assert.equal(input.disabled, false);
  assert.equal(input.value, "");
});

test("an empty answer is ignored", () => {
  const { card, form, submit, correct } = openCard();
  card.show({ a: 2, b: 2 });
  submit("");
  assert.equal(form.classList.contains("shake"), false);
  assert.deepEqual(correct, []);
});
