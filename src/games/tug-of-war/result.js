import { h } from "../../core/ui/dom.js";
import { createOverlayCard } from "../../core/ui/overlay.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/**
 * @typedef {object} ResultOptions
 * @property {boolean} won
 * @property {string} opponentName
 * @property {(() => void) | null} onPlayAgain Only the host starts a new match; null for the guest.
 * @property {() => void} onHome
 * @property {HTMLElement | null} submission The leaderboard status, when both players have an
 *   account.
 */

/**
 * @param {Translate} t
 * @param {ResultOptions} options
 * @returns {{element: HTMLElement, opponentLeft: () => void}} `opponentLeft` replaces "Play
 *   again" (or the guest's waiting line), since no new match can start.
 */
export function createResultPanel(t, { won, opponentName, onPlayAgain, onHome, submission }) {
  const again =
    onPlayAgain === null
      ? h("p", {}, t("tugOfWar.waitingForHost", { name: opponentName }))
      : h(
          "button",
          { type: "button", class: "button", onclick: onPlayAgain },
          t("tugOfWar.playAgain"),
        );
  const element = createOverlayCard(
    h("h2", {}, won ? t("tugOfWar.youWon") : t("tugOfWar.theyWon", { name: opponentName })),
    submission ?? "",
    again,
    h("button", { type: "button", class: "button secondary", onclick: onHome }, t("tugOfWar.home")),
  );
  return {
    element,
    opponentLeft: () => again.replaceWith(h("p", {}, t("tugOfWar.opponentLeft"))),
  };
}
