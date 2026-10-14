import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { translate } from "../src/core/i18n.js";
import { createChallengeDialog } from "../src/games/robot-maze/challenge.js";
import { messages } from "../src/games/robot-maze/i18n.js";
import coreEn from "../src/i18n/en.js";

/** @type {import("../src/core/i18n.js").Translate} */
const t = (key, params) => translate({ ...coreEn, ...messages.en }, key, params);

/** @type {ReturnType<typeof installDom>} */
let dom;
beforeEach(() => {
  dom = installDom();
});

/** @param {(value: number) => void} [onSubmit] */
function openDialog(onSubmit = () => {}) {
  const dialog = createChallengeDialog(t, onSubmit);
  dom.document.body.append(dialog.element);
  const form = /** @type {HTMLFormElement} */ (dialog.element.querySelector("form"));
  const input = /** @type {HTMLInputElement} */ (dialog.element.querySelector("input"));
  return { dialog, form, input };
}

test("show asks for the product of the robot's coordinates", () => {
  const { dialog } = openDialog();
  dialog.show({ row: 7, col: 8 });
  assert.equal(dialog.element.hidden, false);
  assert.equal(dialog.element.querySelector(".rm-question")?.textContent, "7 × 8 = ?");
});

test("a wrong answer shakes the dialog and asks to try again", () => {
  const { dialog, form } = openDialog();
  dialog.show({ row: 3, col: 4 });
  dialog.showWrong();
  assert.ok(form.classList.contains("shake"));
  assert.equal(dialog.element.querySelector(".rm-feedback")?.textContent, "Try again! +5 s");
});

test("the shake from a wrong answer does not carry over to the next robot", () => {
  const { dialog, form } = openDialog();
  dialog.show({ row: 3, col: 4 });
  dialog.showWrong();
  dialog.hide();
  dialog.show({ row: 7, col: 8 });
  assert.equal(form.classList.contains("shake"), false);
});

test("submitting sends the typed number, and an empty answer is ignored", () => {
  /** @type {number[]} */
  const submitted = [];
  const { dialog, form, input } = openDialog((value) => submitted.push(value));
  dialog.show({ row: 6, col: 7 });
  form.requestSubmit();
  input.value = "42";
  form.requestSubmit();
  assert.deepEqual(submitted, [42]);
});
