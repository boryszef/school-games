import { callApi } from "../../core/online/api.js";
import { submitToLeaderboard } from "../../core/ui/leaderboard-submit.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/** @typedef {import("../../core/storage.js").Account} Account */
/**
 * @typedef {object} DuelResult
 * @property {Account | null} account This player's.
 * @property {string | null} opponentId The other player's public id, from their `hello`.
 * @property {string} matchId
 * @property {boolean} won
 */

const MATCH_ID_BYTES = 9;

/** 12 base64url characters, made by the host for each match. */
export function newMatchId() {
  const bytes = crypto.getRandomValues(new Uint8Array(MATCH_ID_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Reports the match to the leaderboard. The win counts only when both players' reports agree
 * (R8.5), so it is sent only when both have a leaderboard id.
 * @param {Translate} t
 * @param {DuelResult} result
 * @returns {HTMLElement | null}
 */
export function submitDuel(t, { account, opponentId, matchId, won }) {
  if (account === null || opponentId === null) return null;
  return submitToLeaderboard(t, async () => {
    await callApi("POST", "/duels", {
      token: account.token,
      body: { matchId, opponentId, won },
      expect: [202],
    });
    return t("tugOfWar.reported");
  });
}
