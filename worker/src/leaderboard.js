import { formatNickname } from "../../src/core/online/nickname.js";
import { TARGET_LANGUAGES } from "../../src/games/color-invasion/colors.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */
/** @typedef {import("../../src/games/robot-maze/state.js").Level} Level */

const TOP = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Always fresh: a cached copy would hide a record the player has just added. */
const CACHE_CONTROL = "no-store";

/**
 * The top 10 of each game, all-time and since Monday 00:00 UTC.
 * @param {{db: Db, now: () => number}} deps
 */
export function createLeaderboard({ db, now }) {
  /**
   * Each player's best time on a level (the earlier run on a tie), fastest first.
   * @param {Level} level
   * @param {number} since
   */
  const mazeTop = async (level, since) => {
    const { results } = await db
      .prepare(
        `SELECT p.color, p.animal, p.number, best.time_ms
         FROM (SELECT player_id, time_ms, finished_at,
                 ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY time_ms, finished_at) AS place
               FROM maze_runs
               WHERE level = ? AND finished_at IS NOT NULL AND finished_at >= ?) AS best
         JOIN players AS p ON p.id = best.player_id
         WHERE best.place = 1
         ORDER BY best.time_ms, best.finished_at
         LIMIT ?`,
      )
      .bind(level, since, TOP)
      .all();
    return results.map((row) => ({ nickname: _nickname(row), timeMs: Number(row.time_ms) }));
  };

  /**
   * Each player's best Color Invasion score in a language (the earlier round on a tie),
   * highest first.
   * @param {string} lang
   * @param {number} since
   */
  const colorTop = async (lang, since) => {
    const { results } = await db
      .prepare(
        `SELECT p.color, p.animal, p.number, best.score
         FROM (SELECT player_id, score, finished_at,
                 ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY score DESC, finished_at) AS place
               FROM color_runs
               WHERE lang = ? AND finished_at IS NOT NULL AND finished_at >= ?) AS best
         JOIN players AS p ON p.id = best.player_id
         WHERE best.place = 1
         ORDER BY best.score DESC, best.finished_at
         LIMIT ?`,
      )
      .bind(lang, since, TOP)
      .all();
    return results.map((row) => ({ nickname: _nickname(row), score: Number(row.score) }));
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
      return {
        status: 200,
        headers: { "Cache-Control": CACHE_CONTROL },
        body: {
          maze: { allTime: await mazeTop("standard", 0), week: await mazeTop("standard", week) },
          mazeHard: { allTime: await mazeTop("hard", 0), week: await mazeTop("hard", week) },
          duels: { allTime: await duelTop(0), week: await duelTop(week) },
          colors: Object.fromEntries(
            await Promise.all(
              Object.keys(TARGET_LANGUAGES).map(async (lang) => [
                lang,
                { allTime: await colorTop(lang, 0), week: await colorTop(lang, week) },
              ]),
            ),
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
