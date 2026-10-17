import { h } from "../../core/ui/dom.js";
import { createOverlayCard } from "../../core/ui/overlay.js";

/** @typedef {import("./state.js").RoundState} RoundState */
/** @typedef {{onPlayAgain: () => void, onHome: () => void}} ResultActions */

/**
 * @param {import("../../core/i18n.js").Translate} t
 * @param {RoundState} state The finished round.
 * @param {ResultActions} actions
 * @param {HTMLElement | null} submission The leaderboard status, for a server-checked run.
 */
export function createResultPanel(t, state, actions, submission) {
  return createOverlayCard(
    h("h2", {}, t("colorInvasion.finished")),
    h("p", { class: "ci-final-score" }, t("colorInvasion.yourScore", { score: state.score })),
    h("p", {}, t("colorInvasion.hits", { count: state.hits })),
    h("p", {}, t("colorInvasion.misses", { count: state.misses })),
    h("p", {}, t("colorInvasion.clears", { count: state.clears })),
    submission ?? "",
    h(
      "button",
      { type: "button", class: "button", onclick: actions.onPlayAgain },
      t("colorInvasion.playAgain"),
    ),
    h(
      "button",
      { type: "button", class: "button secondary", onclick: actions.onHome },
      t("colorInvasion.home"),
    ),
  );
}
