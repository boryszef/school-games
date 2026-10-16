import { h } from "../../core/ui/dom.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/**
 * @typedef {object} ResultOptions
 * @property {boolean} won
 * @property {string} opponentName
 * @property {(() => void) | null} onPlayAgain Only the host starts a new match; null for the guest.
 * @property {() => void} onHome
 * @property {HTMLElement | null} prompt The leaderboard prompt, when both players can add it.
 */

/**
 * @param {Translate} t
 * @param {ResultOptions} options
 * @returns {{element: HTMLElement, opponentLeft: () => void}} `opponentLeft` replaces "Play
 *   again" (or the guest's waiting line), since no new match can start.
 */
export function createResultPanel(t, { won, opponentName, onPlayAgain, onHome, prompt }) {
  const again =
    onPlayAgain === null
      ? h("p", {}, t("tugOfWar.waitingForHost", { name: opponentName }))
      : h(
          "button",
          { type: "button", class: "button", onclick: onPlayAgain },
          t("tugOfWar.playAgain"),
        );
  const element = h(
    "div",
    { class: "tw-overlay" },
    h(
      "div",
      { class: "tw-panel" },
      h("h2", {}, won ? t("tugOfWar.youWon") : t("tugOfWar.theyWon", { name: opponentName })),
      prompt ?? "",
      again,
      h(
        "button",
        { type: "button", class: "button secondary", onclick: onHome },
        t("tugOfWar.home"),
      ),
    ),
  );
  return {
    element,
    opponentLeft: () => again.replaceWith(h("p", {}, t("tugOfWar.opponentLeft"))),
  };
}
