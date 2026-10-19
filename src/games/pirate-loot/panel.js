import { h } from "../../core/ui/dom.js";
import { createNumpad } from "../../core/ui/numpad.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/**
 * @typedef {object} PanelHandlers
 * @property {(answer: number) => void} onAnswer
 * @property {() => void} onSail
 * @property {() => void} onRetire
 */

/** The answers go up to 10. */
const MAX_DIGITS = 2;

/**
 * Under the scene: the question with the crew's patience and the number pad, or after a won
 * trip the choice between sailing again and retiring.
 * @param {Translate} t
 * @param {PanelHandlers} handlers
 */
export function createPanel(t, { onAnswer, onSail, onRetire }) {
  const question = h("p", { class: "pl-question" });
  const fuseLeft = h("div", { class: "pl-fuse-left" });
  const seconds = h("span", { class: "pl-seconds" });
  const input = h("input", {
    class: "pl-answer",
    inputmode: "numeric",
    autocomplete: "off",
    maxlength: MAX_DIGITS,
    "aria-label": t("pirateLoot.answer"),
  });
  const numpad = createNumpad(
    {
      onDigit: (digit) => (input.value = (input.value + digit).slice(0, MAX_DIGITS)),
      onDelete: () => (input.value = input.value.slice(0, -1)),
      onSubmit: submit,
    },
    t,
  );
  const form = h(
    "form",
    { class: "pl-ask", hidden: true },
    question,
    h("div", { class: "pl-patience" }, input, h("div", { class: "pl-fuse" }, fuseLeft), seconds),
    numpad,
  );
  const cheer = h("p", { class: "pl-cheer", "aria-live": "polite" });
  const retire = h("button", { type: "button", class: "button secondary", onclick: onRetire });
  const choice = h(
    "div",
    { class: "pl-choice", hidden: true },
    cheer,
    h("button", { type: "button", class: "button", onclick: onSail }, t("pirateLoot.sailAgain")),
    retire,
  );
  const element = h("div", { class: "pl-panel" }, form, choice);

  input.addEventListener("input", () => (input.value = input.value.replace(/\D/g, "")));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });

  function submit() {
    if (input.value === "") return;
    onAnswer(Number(input.value));
  }

  return {
    element,
    /**
     * @param {number} crew
     * @param {number} coins
     */
    ask(crew, coins) {
      question.replaceChildren(..._highlightNumbers(t("pirateLoot.question", { crew, coins })));
      input.value = "";
      choice.hidden = true;
      form.hidden = false;
      // Only with a mouse/keyboard, so phones don't pop up their own keyboard over the pad.
      if (matchMedia("(pointer: fine)").matches) input.focus();
    },
    /**
     * @param {number} remainingMs
     * @param {number} limitMs
     */
    showPatience(remainingMs, limitMs) {
      fuseLeft.style.width = `${(100 * remainingMs) / limitMs}%`;
      seconds.textContent = t("pirateLoot.timeLeft", { seconds: Math.ceil(remainingMs / 1000) });
    },
    /**
     * @param {number} share
     * @param {number} loot
     */
    offerChoice(share, loot) {
      cheer.textContent = t("pirateLoot.cheer", { share });
      retire.textContent = t("pirateLoot.retire", { loot });
      form.hidden = true;
      choice.hidden = false;
    },
    hide() {
      form.hidden = true;
      choice.hidden = true;
    },
  };
}

/**
 * The numbers in a text wrapped in spans, so they stand out from the words.
 * @param {string} text
 */
function _highlightNumbers(text) {
  return text
    .split(/(\d+)/)
    .map((part, i) => (i % 2 === 1 ? h("span", { class: "pl-number" }, part) : part));
}
