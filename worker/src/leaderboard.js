import { formatNickname } from "../../src/core/online/nickname.js";
import { TARGET_LANGUAGES } from "../../src/games/color-invasion/colors.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */

/**
 * Where a "best run per player" ranking comes from. Every name is a constant in the code,
 * never input.
 * @typedef {object} BestRunQuery
 * @property {string} table
 * @property {string} variant The column that splits the rankings, such as the level.
 * @property {string} value The column ranked on.
 * @property {"ASC" | "DESC"} order
 * @property {string} field What the value is called in the response.
 */

const TOP = 10;
/** @type {BestRunQuery} */
const MAZE_TIMES = {
  table: "maze_runs",
  variant: "level",
  value: "time_ms",
  order: "ASC",
  field: "timeMs",
};
/** @type {BestRunQuery} */
const COLOR_SCORES = {
  table: "color_runs",
  variant: "lang",
  value: "score",
  order: "DESC",
  field: "score",
};
const DAY_MS = 24 * 60 * 60 * 1000;
/** Always fresh: a cached copy would hide a record the player has just added. */
const CACHE_CONTROL = "no-store";

/**
 * The top 10 of each game, all-time and since Monday 00:00 UTC.
 * @param {{db: Db, now: () => number}} deps
 */
export function createLeaderboard({ db, now }) {
  /**
   * Each player's best finished run of one kind (the earlier run on a tie), best first.
   * @param {BestRunQuery} query
   * @param {string} variantValue Such as the maze level or the color language.
   * @param {number} since
   */
  const bestPerPlayer = async ({ table, variant, value, order, field }, variantValue, since) => {
    const { results } = await db
      .prepare(
        `SELECT p.color, p.animal, p.number, best.${value} AS value
         FROM (SELECT player_id, ${value}, finished_at,
                 ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY ${value} ${order}, finished_at)
                   AS place
               FROM ${table}
               WHERE ${variant} = ? AND finished_at IS NOT NULL AND finished_at >= ?) AS best
         JOIN players AS p ON p.id = best.player_id
         WHERE best.place = 1
         ORDER BY best.${value} ${order}, best.finished_at
         LIMIT ?`,
      )
      .bind(variantValue, since, TOP)
      .all();
    return results.map((row) => ({ nickname: _nickname(row), [field]: Number(row.value) }));
  };

  /** Most wins first; on a tie, whoever got there first. */
  const duelTop = async (/** @type {number} */ since) => {
    const { results } = await db
      .prepare(
        `SELECT p.color, p.animal, p.number, COUNT(*) AS wins, MAX(w.won_at) AS last_win
         FROM duel_wins AS w JOIN players AS p ON p.id = w.winner_id
         WHERE w.won_at >= ?
         GROUP BY w.winner_id
         ORDER BY wins DESC, last_win
         LIMIT ?`,
      )
      .bind(since, TOP)
      .all();
    return results.map((row) => ({ nickname: _nickname(row), wins: Number(row.wins) }));
  };

  return {
    /** @returns {Promise<Reply>} */
    async get() {
      const week = _weekStart(now());
      /** @param {(since: number) => Promise<object[]>} top */
      const rankings = async (top) => ({ allTime: await top(0), week: await top(week) });
      /** @param {string} lang */
      const colorRankings = async (lang) => [
        lang,
        await rankings((since) => bestPerPlayer(COLOR_SCORES, lang, since)),
      ];
      return {
        status: 200,
        headers: { "Cache-Control": CACHE_CONTROL },
        body: {
          maze: await rankings((since) => bestPerPlayer(MAZE_TIMES, "standard", since)),
          mazeHard: await rankings((since) => bestPerPlayer(MAZE_TIMES, "hard", since)),
          duels: await rankings(duelTop),
          colors: Object.fromEntries(
            await Promise.all(Object.keys(TARGET_LANGUAGES).map(colorRankings)),
          ),
        },
      };
    },
  };
}

/** @param {Record<string, unknown>} row */
function _nickname(row) {
  return formatNickname({
    color: Number(row.color),
    animal: Number(row.animal),
    number: Number(row.number),
  });
}

/**
 * Monday 00:00 UTC of the week that contains `time`.
 * @param {number} time
 */
function _weekStart(time) {
  const daysSinceMonday = (new Date(time).getUTCDay() + 6) % 7;
  return time - (time % DAY_MS) - daysSinceMonday * DAY_MS;
}
