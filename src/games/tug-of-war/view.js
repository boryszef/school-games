import { h } from "../../core/ui/dom.js";
import { createQuestionCard } from "./question.js";
import { createResultPanel } from "./result.js";
import { createRope } from "./rope.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/** @typedef {import("./match.js").Question} Question */
/** @typedef {import("./question.js").CorrectAnswer} CorrectAnswer */
/**
 * @typedef {object} MatchViewOptions
 * @property {Translate} t
 * @property {string} myName
 * @property {(answer: CorrectAnswer) => void} onCorrect
 * @property {(() => void) | null} onPlayAgain Null for the guest, who waits for the host.
 * @property {() => void} onHome
 * @property {(won: boolean) => HTMLElement | null} prompt The leaderboard prompt, if offered.
 */

/**
 * What both players see during a match. Rope positions are from this player's side
 * (negative = towards me).
 * @param {HTMLElement} root
 * @param {MatchViewOptions} options
 */
export function createMatchView(root, { t, myName, onCorrect, onPlayAgain, onHome, prompt }) {
  let opponentName = "…";
  const rope = createRope(myName);
  const card = createQuestionCard(t, onCorrect);
  const status = h("p", { class: "tw-status", "aria-live": "polite" });
  const stage = h("div", { class: "tw-stage" }, card.element);
  root.replaceChildren(
    h(
      "div",
      { class: "tw" },
      h("p", { class: "tw-goal-text" }, t("tugOfWar.goal")),
      rope.element,
      status,
      stage,
    ),
  );

  /** @param {Node} node */
  const showOverlay = (node) => stage.append(node);

  return {
    /** @param {string} name */
    setOpponent(name) {
      opponentName = name;
      rope.setOpponent(name);
    },
    /** A new match: rope in the middle, no result. */
    reset() {
      stage.replaceChildren(card.element);
      rope.move(0);
      card.lock();
      status.textContent = t("tugOfWar.getReady");
    },
    /** @param {Question} question */
    ask(question) {
      status.textContent = "";
      card.show(question);
    },
    /**
     * @param {number} position
     * @param {boolean} mine Whether this player won the round.
     */
    tug(position, mine) {
      card.lock();
      rope.move(position);
      status.textContent = mine
        ? t("tugOfWar.yourPoint")
        : t("tugOfWar.theirPoint", { name: opponentName });
    },
    /** @param {boolean} won */
    finish(won) {
      card.lock();
      showOverlay(
        createResultPanel(t, { won, opponentName, onPlayAgain, onHome, prompt: prompt(won) }),
      );
    },
    connectionLost() {
      card.lock();
      showOverlay(
        h(
          "div",
          { class: "tw-overlay" },
          h(
            "div",
            { class: "tw-panel" },
            h("p", {}, t("tugOfWar.connectionLost")),
            h("button", { type: "button", class: "button", onclick: onHome }, t("tugOfWar.home")),
          ),
        ),
      );
    },
  };
}
