import { h } from "../../core/ui/dom.js";
import { createBoard } from "./board.js";
import { COLOR_NAMES } from "./colors.js";
import { createControls } from "./controls.js";
import { createScoreDisplay } from "./score.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/** @typedef {import("./colors.js").TargetLanguage} TargetLanguage */
/** @typedef {import("./controls.js").Command} Command */
/** @typedef {import("./state.js").RoundState} RoundState */
/** @typedef {import("./state.js").ShotOutcome} ShotOutcome */
/**
 * @typedef {object} RoundViewOptions
 * @property {Translate} t
 * @property {TargetLanguage} lang
 * @property {number} columnCount
 * @property {(command: Command) => void} onCommand
 * @property {(column: number) => void} onColumnTap
 */

/**
 * The screen of one round: clock, score, the color word, the board and the controls.
 * @param {HTMLElement} root
 * @param {RoundViewOptions} options
 */
export function createRoundView(root, { t, lang, columnCount, onCommand, onColumnTap }) {
  const clock = h("p", { class: "ci-hud" });
  const score = createScoreDisplay(t);
  const word = h("p", { class: "ci-word" });
  const board = createBoard(columnCount, onColumnTap);
  const stage = h("div", { class: "ci-stage" }, board.element);
  root.replaceChildren(
    h(
      "div",
      { class: "ci" },
      h("p", { class: "ci-goal" }, t("colorInvasion.goal")),
      clock,
      score.element,
      h("p", { class: "ci-prompt" }, t("colorInvasion.shootThis")),
      word,
      stage,
      createControls(t, onCommand),
    ),
  );

  return {
    /** @param {RoundState} state */
    show(state) {
      word.textContent = COLOR_NAMES[lang][state.target];
      score.show(state.score);
      board.update(state);
    },
    /** @param {number} remainingMs */
    showTime(remainingMs) {
      clock.textContent = t("colorInvasion.timeLeft", { seconds: Math.ceil(remainingMs / 1000) });
    },
    /**
     * Plays a shot's effects on the board and the score.
     * @param {ShotOutcome} outcome
     * @param {number} column
     * @param {number} points
     */
    showShot(outcome, column, points) {
      board.flash(outcome, column);
      score.react(outcome, points);
    },
    /** @param {HTMLElement} panel */
    showResult(panel) {
      stage.append(panel);
    },
  };
}
