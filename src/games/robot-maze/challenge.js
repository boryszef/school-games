import { h } from "../../core/ui/dom.js";
import { createNumpad } from "../../core/ui/numpad.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/** @typedef {import("./maze.js").Position} Position */

const MAX_DIGITS = 3;

/**
 * Overlay asking for the product of the robot's coordinates.
 * @param {Translate} t
 * @param {(value: number) => void} onSubmit
 */
export function createChallengeDialog(t, onSubmit) {
  const question = h("p", { class: "rm-question" });
  const input = h("input", {
    class: "rm-answer",
    inputmode: "numeric",
    autocomplete: "off",
    maxlength: MAX_DIGITS,
    "aria-label": t("robotMaze.answer"),
  });
  const feedback = h("p", { class: "rm-feedback", "aria-live": "polite" });
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
    { class: "overlay-card" },
    h("div", { class: "rm-robot" }, "🤖"),
    question,
    input,
    feedback,
    numpad,
  );
  const element = h("div", { class: "overlay", hidden: true }, form);

  input.addEventListener("input", () => (input.value = input.value.replace(/\D/g, "")));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });

  function submit() {
    if (input.value === "") return;
    onSubmit(Number(input.value));
  }

  /** Focus only with a mouse/keyboard, so tablets don't pop up their own keyboard over the numpad. */
  function focusInput() {
    if (matchMedia("(pointer: fine)").matches) input.focus();
  }

  return {
    element,
    /** @param {Position} pos */
    show(pos) {
      question.textContent = t("robotMaze.question", { a: pos.row, b: pos.col });
      input.value = "";
      feedback.textContent = "";
      form.classList.remove("shake"); // otherwise the previous robot's shake replays on reopening
      element.hidden = false;
      focusInput();
    },
    showWrong() {
      feedback.textContent = t("robotMaze.tryAgain");
      input.value = "";
      form.classList.remove("shake");
      void form.offsetWidth; // restart the animation
      form.classList.add("shake");
      focusInput();
    },
    hide() {
      element.hidden = true;
    },
  };
}
