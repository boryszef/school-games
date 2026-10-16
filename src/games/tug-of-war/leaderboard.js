import { callApi } from "../../core/online/api.js";
import { createLeaderboardPrompt } from "../../core/ui/leaderboard-prompt.js";

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
 * The leaderboard prompt after a match. The win counts only if both players say yes (R8.5),
 * so it is offered only when both have a leaderboard id.
 * @param {Translate} t
 * @param {DuelResult} result
 * @returns {HTMLElement | null}
 */
export function createDuelPrompt(t, { account, opponentId, matchId, won }) {
  if (account === null || opponentId === null) return null;
  return createLeaderboardPrompt(t, async () => {
    await callApi("POST", "/duels", {
      token: account.token,
      body: { matchId, opponentId, won },
      expect: [202],
    });
    return t("tugOfWar.reported");
  });
}
