import { BadRequestError, hasExactly } from "./http.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */
/** @typedef {{matchId: string, opponentId: string, won: boolean}} DuelReport */

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_TTL_MS = DAY_MS;
/** More wins over the same opponent in one UTC day don't count, to stop farming. */
const DAILY_WIN_CAP = 3;
const MATCH_ID = /^[A-Za-z0-9_-]{12}$/;

/**
 * Tug of War wins: each player reports the match, and a win counts only when the two reports
 * agree, so one player alone can't make one up.
 * @param {{db: Db, now: () => number, playerExists: (id: string) => Promise<boolean>}} deps
 */
export function createDuels({ db, now, playerExists }) {
  return {
    /**
     * @param {string} playerId
     * @param {Record<string, unknown>} body
     * @returns {Promise<Reply>}
     * @throws {BadRequestError}
     */
    async report(playerId, body) {
      const { matchId, opponentId, won } = _report(body, playerId);
      if (!(await playerExists(opponentId))) return { status: 404 };
      await db
        .prepare("DELETE FROM duel_reports WHERE created_at <= ?")
        .bind(now() - REPORT_TTL_MS)
        .run();
      const { meta } = await db
        .prepare(
          `INSERT OR IGNORE INTO duel_reports (match_id, reporter_id, opponent_id, won, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(matchId, playerId, opponentId, Number(won), now())
        .run();
      if (meta.changes === 0) return { status: 409 };

      const other = await db
        .prepare("SELECT opponent_id, won FROM duel_reports WHERE match_id = ? AND reporter_id = ?")
        .bind(matchId, opponentId)
        .first();
      if (other === null) return { status: 202 };
      await db.prepare("DELETE FROM duel_reports WHERE match_id = ?").bind(matchId).run();
      const agree = other.opponent_id === playerId && Boolean(other.won) !== won;
      if (agree)
        await _recordWin(matchId, won ? playerId : opponentId, won ? opponentId : playerId);
      return { status: 202 };
    },
  };

  /**
   * @param {string} matchId
   * @param {string} winnerId
   * @param {string} loserId
   */
  async function _recordWin(matchId, winnerId, loserId) {
    const time = now();
    const today = await db
      .prepare(
        "SELECT COUNT(*) AS wins FROM duel_wins WHERE winner_id = ? AND loser_id = ? AND won_at >= ?",
      )
      .bind(winnerId, loserId, time - (time % DAY_MS))
      .first();
    if (Number(today?.wins) >= DAILY_WIN_CAP) return;
    await db
      .prepare("INSERT INTO duel_wins (match_id, winner_id, loser_id, won_at) VALUES (?, ?, ?, ?)")
      .bind(matchId, winnerId, loserId, time)
      .run();
  }
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} playerId
 * @returns {DuelReport}
 * @throws {BadRequestError}
 */
function _report(body, playerId) {
  const { matchId, opponentId, won } = body;
  const valid =
    hasExactly(body, ["matchId", "opponentId", "won"]) &&
    typeof matchId === "string" &&
    MATCH_ID.test(matchId) &&
    typeof opponentId === "string" &&
    opponentId !== playerId &&
    typeof won === "boolean";
  if (!valid) throw new BadRequestError("invalid duel report");
  return { matchId, opponentId, won };
}
