import { h } from "../../core/ui/dom.js";

/** @typedef {import("./state.js").ShotOutcome} ShotOutcome */

/** Outcomes that also pulse the score, with the class that does it. */
/** @type {Partial<Record<ShotOutcome, string>>} */
const PULSES = { clear: "is-bonus", miss: "is-penalty" };

/**
 * The big score row; each shot shows its points as a pop-up rising from the score.
 * @param {import("../../core/i18n.js").Translate} t
 */
export function createScoreDisplay(t) {
  const score = h("span", { class: "ci-score" });
  /** Pop-ups are placed next to the score, so they follow its width. */
  const anchor = h("span", { class: "ci-score-anchor" }, score);
  const element = h("div", { class: "ci-score-row" }, anchor);

  return {
    element,
    /** @param {number} points */
    show(points) {
      score.textContent = t("colorInvasion.score", { score: points });
    },
    /**
     * @param {ShotOutcome} outcome
     * @param {number} points The change the shot made to the score.
     */
    react(outcome, points) {
      const popup = h(
        "span",
        { class: `ci-popup is-${outcome}` },
        points < 0 ? `−${-points}` : `+${points}`,
      );
      popup.addEventListener("animationend", () => popup.remove());
      anchor.append(popup);
      const pulse = PULSES[outcome];
      if (pulse === undefined) return;
      score.classList.remove(...Object.values(PULSES));
      void score.offsetWidth; // restarts the CSS animation
      score.classList.add(pulse);
    },
  };
}
