import { h } from "../../core/ui/dom.js";
import { createOverlayCard } from "../../core/ui/overlay.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/** @typedef {import("./state.js").GameState} GameState */
/** @typedef {{onPlayAgain: () => void, onHome: () => void}} ResultActions */

/**
 * The card at the end: the loot when the captain retired, or the lost loot and the right
 * division when the crew threw them overboard (R11.9).
 * @param {Translate} t
 * @param {{state: GameState, lostLoot: number}} ending The finished game; `lostLoot` is what
 *   the captain had before going overboard.
 * @param {ResultActions} actions
 * @param {HTMLElement | null} submission The leaderboard status, for a server-checked game.
 */
export function createResultPanel(t, { state, lostLoot }, actions, submission) {
  const { crew, treasure, loot, trip } = state;
  const retired = state.status === "retired";
  return createOverlayCard(
    ...(retired
      ? [
          h("h2", {}, t("pirateLoot.retiredTitle")),
          h("p", { class: "pl-final-loot" }, t("pirateLoot.retiredLoot", { loot })),
        ]
      : [
          h("h2", {}, t("pirateLoot.overboardTitle")),
          h("p", {}, t("pirateLoot.overboardText", { loot: lostLoot })),
          h(
            "p",
            { class: "pl-right-answer" },
            t("pirateLoot.rightAnswer", { treasure, crew, share: treasure / crew }),
          ),
        ]),
    h("p", {}, t("pirateLoot.tripsWon", { count: retired ? trip : trip - 1 })),
    submission ?? "",
    h(
      "button",
      { type: "button", class: "button", onclick: actions.onPlayAgain },
      t("pirateLoot.playAgain"),
    ),
    h(
      "button",
      { type: "button", class: "button secondary", onclick: actions.onHome },
      t("pirateLoot.home"),
    ),
  );
}
