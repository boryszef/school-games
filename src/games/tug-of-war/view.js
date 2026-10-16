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
 * @property {(won: boolean) => HTMLElement | null} submission Sends the result to the
 *   leaderboard and shows its status, when both players have an account.
 */

/**
 * What both players see during a match. Rope positions are from this player's side
 * (negative = towards me).
 * @param {HTMLElement} root
 * @param {MatchViewOptions} options
 */
export function createMatchView(root, { t, myName, onCorrect, onPlayAgain, onHome, submission }) {
  let opponentName = "…";
  /** @type {ReturnType<typeof createResultPanel> | null} The ended match's result, if shown. */
  let result = null;
  /** After a version mismatch nothing else replaces its message. */
  let stopped = false;
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
  /** @param {string} key */
  const showMessage = (key) =>
    showOverlay(
      h(
        "div",
        { class: "tw-overlay" },
        h(
          "div",
          { class: "tw-panel" },
          h("p", {}, t(key)),
          h("button", { type: "button", class: "button", onclick: onHome }, t("tugOfWar.home")),
        ),
      ),
    );

  return {
    /** @param {string} name */
    setOpponent(name) {
      opponentName = name;
      rope.setOpponent(name);
    },
    /** A new match: rope in the middle, no result. */
    reset() {
      result = null;
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
      result = createResultPanel(t, {
        won,
        opponentName,
        onPlayAgain,
        onHome,
        submission: submission(won),
      });
      showOverlay(result.element);
    },
    /** A finished match keeps its result and leaderboard status; only a new match becomes impossible. */
    connectionLost() {
      if (stopped) return;
      card.lock();
      if (result === null) showMessage("tugOfWar.connectionLost");
      else result.opponentLeft();
    },
    versionMismatch() {
      stopped = true;
      card.lock();
      showMessage("tugOfWar.versionMismatch");
    },
  };
}
