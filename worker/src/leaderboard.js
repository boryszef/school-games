import { formatNickname } from "../../src/core/online/nickname.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */

const TOP = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_CONTROL = "public, max-age=60";

/**
 * The top 10 of each game, all-time and since Monday 00:00 UTC.
 * @param {{db: Db, now: () => number}} deps
 */
export function createLeaderboard({ db, now }) {
  /** Each player's best time (the earlier run on a tie), fastest first. */
  const mazeTop = async (/** @type {number} */ since) => {
    const { results } = await db
      .prepare(
        `SELECT p.color, p.animal, p.number, best.time_ms
         FROM (SELECT player_id, time_ms, finished_at,
                 ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY time_ms, finished_at) AS place
               FROM maze_runs WHERE finished_at IS NOT NULL AND finished_at >= ?) AS best
         JOIN players AS p ON p.id = best.player_id
         WHERE best.place = 1
         ORDER BY best.time_ms, best.finished_at
         LIMIT ?`,
      )
      .bind(since, TOP)
      .all();
    return results.map((row) => ({ nickname: _nickname(row), timeMs: Number(row.time_ms) }));
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
          maze: { allTime: await mazeTop(0), week: await mazeTop(week) },
          duels: { allTime: await duelTop(0), week: await duelTop(week) },
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
