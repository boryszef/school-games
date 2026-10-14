import { formatTime } from "../../core/format.js";
import { h } from "../../core/ui/dom.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/**
 * @typedef {object} ResultSummary
 * @property {number} timeMs
 * @property {number} mistakes
 * @property {number | null} previousBestMs
 */
/** @typedef {{onPlayAgain: () => void, onHome: () => void}} ResultActions */

/**
 * @param {Translate} t
 * @param {ResultSummary} summary
 * @param {ResultActions} actions
 */
export function createResultPanel(t, summary, actions) {
  const { timeMs, mistakes, previousBestMs } = summary;
  const record =
    previousBestMs !== null && timeMs >= previousBestMs
      ? h("p", {}, t("robotMaze.best", { time: formatTime(previousBestMs) }))
      : h("p", { class: "rm-new-best" }, t("robotMaze.newBest"));

  return h(
    "div",
    { class: "rm-overlay" },
    h(
      "div",
      { class: "rm-card" },
      h("h2", {}, t("robotMaze.finished")),
      h("p", { class: "rm-final-time" }, t("robotMaze.yourTime", { time: formatTime(timeMs) })),
      h("p", {}, t("robotMaze.mistakes", { count: mistakes })),
      record,
      h(
        "button",
        { type: "button", class: "button", onclick: actions.onPlayAgain },
        t("robotMaze.playAgain"),
      ),
      h(
        "button",
        { type: "button", class: "button secondary", onclick: actions.onHome },
        t("robotMaze.home"),
      ),
    ),
  );
}
