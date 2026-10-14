import { h } from "../../core/ui/dom.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/**
 * @typedef {object} ResultOptions
 * @property {boolean} won
 * @property {string} opponentName
 * @property {(() => void) | null} onPlayAgain Only the host starts a new match; null for the guest.
 * @property {() => void} onHome
 */

/**
 * @param {Translate} t
 * @param {ResultOptions} options
 */
export function createResultPanel(t, { won, opponentName, onPlayAgain, onHome }) {
  const again =
    onPlayAgain === null
      ? h("p", {}, t("tugOfWar.waitingForHost", { name: opponentName }))
      : h(
          "button",
          { type: "button", class: "button", onclick: onPlayAgain },
          t("tugOfWar.playAgain"),
        );
  return h(
    "div",
    { class: "tw-overlay" },
    h(
      "div",
      { class: "tw-panel" },
      h("h2", {}, won ? t("tugOfWar.youWon") : t("tugOfWar.theyWon", { name: opponentName })),
      again,
      h(
        "button",
        { type: "button", class: "button secondary", onclick: onHome },
        t("tugOfWar.home"),
      ),
    ),
  );
}
