import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import { messages } from "../src/games/color-invasion/i18n.js";
import { createScoreDisplay } from "../src/games/color-invasion/score.js";

/** @type {ReturnType<typeof installDom>} */
let dom;
beforeEach(() => {
  dom = installDom();
});

function display() {
  const scoreDisplay = createScoreDisplay((key, params) => translate(messages.en, key, params));
  const score = /** @type {HTMLElement} */ (scoreDisplay.element.querySelector(".ci-score"));
  const popups = () => [...scoreDisplay.element.querySelectorAll(".ci-popup")];
  return { scoreDisplay, score, popups };
}

test("the score shows the points, below zero too", () => {
  const { scoreDisplay, score } = display();
  scoreDisplay.show(12);
  assert.equal(score.textContent, "Points: 12");
  scoreDisplay.show(-3);
  assert.equal(score.textContent, "Points: -3");
});

test("a correct hit shows a small +1 without pulsing the score", () => {
  const { scoreDisplay, score, popups } = display();
  scoreDisplay.react("hit", 1);
  assert.deepEqual(
    popups().map((p) => [p.textContent, p.classList.contains("is-hit")]),
    [["+1", true]],
  );
  assert.ok(!score.classList.contains("is-bonus") && !score.classList.contains("is-penalty"));
});

test("a bonus shows the points gained and pulses the score", () => {
  const { scoreDisplay, score, popups } = display();
  scoreDisplay.react("clear", 6);
  assert.equal(popups()[0].textContent, "+6");
  assert.ok(popups()[0].classList.contains("is-clear"));
  assert.ok(score.classList.contains("is-bonus"));
});

test("a penalty shows a minus sign and pulses the score", () => {
  const { scoreDisplay, score, popups } = display();
  scoreDisplay.react("miss", -1);
  assert.equal(popups()[0].textContent, "−1");
  assert.ok(popups()[0].classList.contains("is-miss"));
  assert.ok(score.classList.contains("is-penalty"));
});

test("a bonus right after a penalty switches the pulse", () => {
  const { scoreDisplay, score } = display();
  scoreDisplay.react("miss", -1);
  scoreDisplay.react("clear", 6);
  assert.ok(score.classList.contains("is-bonus"));
  assert.ok(!score.classList.contains("is-penalty"));
});

test("quick shots stack their pop-ups, and each one goes away when its animation ends", () => {
  const { scoreDisplay, popups } = display();
  scoreDisplay.react("hit", 1);
  scoreDisplay.react("miss", -1);
  assert.equal(popups().length, 2);
  popups()[0].dispatchEvent(new dom.Event("animationend"));
  assert.deepEqual(
    popups().map((p) => p.textContent),
    ["−1"],
  );
});
