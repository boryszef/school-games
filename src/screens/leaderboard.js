import { formatTime } from "../core/format.js";
import { ApiError, ServerUnreachableError, callApi } from "../core/online/api.js";
import { h } from "../core/ui/dom.js";
import { TARGET_LANGUAGES } from "../games/color-invasion/colors.js";

/** @typedef {import("../core/app.js").App} App */
/** @typedef {{nickname: string, timeMs: number}} MazeEntry */
/** @typedef {{nickname: string, wins: number}} DuelEntry */
/** @typedef {{nickname: string, score: number}} ColorEntry */
/** @typedef {import("../games/color-invasion/colors.js").TargetLanguage} TargetLanguage */
/**
 * @template Entry
 * @typedef {{allTime: Entry[], week: Entry[]}} Rankings
 */
/**
 * @typedef {object} Leaderboard
 * @property {Rankings<MazeEntry>} maze
 * @property {Rankings<DuelEntry>} duels
 * @property {Record<TargetLanguage, Rankings<ColorEntry>>} colors One ranking per language.
 */

/** @type {import("../core/app.js").Screen} */
export function renderLeaderboard(root, app) {
  const { t } = app;
  let active = true;
  const title = h("h1", {}, t("leaderboard.title"));
  root.replaceChildren(title, h("p", {}, t("leaderboard.loading")));

  callApi("GET", "/leaderboard", { expect: [200] }).then(
    ({ data }) => {
      if (active) root.replaceChildren(title, ..._sections(app, data));
    },
    (error) => {
      if (!(error instanceof ServerUnreachableError || error instanceof ApiError)) throw error;
      if (active)
        root.replaceChildren(title, h("p", { class: "notice" }, t("leaderboard.unreachable")));
    },
  );
  return () => {
    active = false;
  };
}

/**
 * @param {App} app
 * @param {Leaderboard} board
 */
function _sections(app, board) {
  const { t } = app;
  const me = app.data.player?.name ?? null;
  /** @param {MazeEntry} entry */
  const time = (entry) => formatTime(entry.timeMs);
  /** @param {DuelEntry} entry */
  const wins = (entry) => String(entry.wins);
  /** @param {ColorEntry} entry */
  const points = (entry) => String(entry.score);
  const languages = /** @type {[TargetLanguage, string][]} */ (Object.entries(TARGET_LANGUAGES));
  return [
    _section(t, "🤖 " + t("robotMaze.title"), board.maze, t("leaderboard.time"), time, me),
    _section(t, "🪢 " + t("tugOfWar.title"), board.duels, t("leaderboard.wins"), wins, me),
    ...languages.map(([lang, name]) =>
      _section(
        t,
        `👾 ${t("colorInvasion.title")} – ${name}`,
        board.colors[lang],
        t("leaderboard.points"),
        points,
        me,
      ),
    ),
  ];
}

/**
 * @template {{nickname: string}} Entry
 * @param {App["t"]} t
 * @param {string} title
 * @param {Rankings<Entry>} rankings
 * @param {string} valueHeading
 * @param {(entry: Entry) => string} value
 * @param {string | null} me The current player's nickname, whose rows are highlighted.
 */
function _section(t, title, rankings, valueHeading, value, me) {
  /**
   * @param {string} heading
   * @param {Entry[]} entries
   */
  const table = (heading, entries) =>
    h(
      "div",
      { class: "lb-ranking" },
      h("h3", {}, heading),
      entries.length === 0
        ? h("p", {}, t("leaderboard.empty"))
        : h(
            "table",
            { class: "lb-table" },
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                h("th", {}, "#"),
                h("th", {}, t("leaderboard.player")),
                h("th", {}, valueHeading),
              ),
            ),
            h(
              "tbody",
              {},
              ...entries.map((entry, i) =>
                h(
                  "tr",
                  { class: entry.nickname === me ? "is-me" : "" },
                  h("td", {}, String(i + 1)),
                  h("td", {}, entry.nickname),
                  h("td", {}, value(entry)),
                ),
              ),
            ),
          ),
    );
  return h(
    "section",
    { class: "lb-section" },
    h("h2", {}, title),
    h(
      "div",
      { class: "lb-rankings" },
      table(t("leaderboard.allTime"), rankings.allTime),
      table(t("leaderboard.week"), rankings.week),
    ),
  );
}
