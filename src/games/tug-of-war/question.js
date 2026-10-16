import { h } from "../../core/ui/dom.js";
import { createNumpad } from "../../core/ui/numpad.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/** @typedef {import("./match.js").Question} Question */
/** @typedef {{value: number, reactionMs: number}} CorrectAnswer */

/** How long a wrong answer blocks the player. */
export const FREEZE_MS = 2000;
const MAX_DIGITS = 3;

/**
 * The question card. It checks answers itself: a correct one is reported with the reaction time
 * since the question appeared, a wrong one freezes the card for `FREEZE_MS`.
 * @param {Translate} t
 * @param {(answer: CorrectAnswer) => void} onCorrect
 * @param {() => number} [now]
 */
export function createQuestionCard(t, onCorrect, now = () => performance.now()) {
  /** @type {Question | null} */
  let question = null;
  let shownAt = 0;
  let accepting = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let unfreezeTimer;

  const text = h("p", { class: "tw-question" });
  const input = h("input", {
    class: "tw-answer",
    inputmode: "numeric",
    autocomplete: "off",
    maxlength: MAX_DIGITS,
    "aria-label": t("tugOfWar.answer"),
  });
  const feedback = h("p", { class: "tw-feedback", "aria-live": "polite" });
  const numpad = createNumpad(
    {
      onDigit: (digit) => {
        if (accepting) input.value = (input.value + digit).slice(0, MAX_DIGITS);
      },
      onDelete: () => (input.value = input.value.slice(0, -1)),
      onSubmit: submit,
    },
    t,
  );
  const form = h("form", { class: "tw-card" }, text, input, feedback, numpad);
  input.addEventListener("input", () => (input.value = input.value.replace(/\D/g, "")));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  setAccepting(false);

  function submit() {
    if (!accepting || question === null || input.value === "") return;
    const value = Number(input.value);
    if (value === question.a * question.b) {
      setAccepting(false);
      text.textContent = "";
      input.value = "";
      feedback.textContent = t("tugOfWar.correct");
      onCorrect({ value, reactionMs: now() - shownAt });
    } else {
      freeze();
    }
  }

  function freeze() {
    setAccepting(false);
    input.value = "";
    feedback.textContent = t("tugOfWar.wrong");
    form.classList.remove("shake");
    void form.offsetWidth; // restart the animation
    form.classList.add("shake");
    unfreezeTimer = setTimeout(() => {
      feedback.textContent = "";
      setAccepting(true);
    }, FREEZE_MS);
  }

  /** @param {boolean} on */
  function setAccepting(on) {
    accepting = on;
    input.disabled = !on;
    for (const key of numpad.querySelectorAll("button")) key.disabled = !on;
    // Focus only with a mouse/keyboard, so tablets don't pop up their keyboard over the numpad.
    if (on && matchMedia("(pointer: fine)").matches) input.focus();
  }

  return {
    element: h("div", { class: "tw-question-area" }, form),
    /** @param {Question} next */
    show(next) {
      clearTimeout(unfreezeTimer);
      question = next;
      text.textContent = t("tugOfWar.question", { a: next.a, b: next.b });
      input.value = "";
      feedback.textContent = "";
      form.classList.remove("shake");
      shownAt = now();
      setAccepting(true);
    },
    /** Blocks answers until the next question. */
    lock() {
      clearTimeout(unfreezeTimer);
      setAccepting(false);
    },
  };
}
