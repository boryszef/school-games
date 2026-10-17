import { log } from "../../core/log.js";
import { ApiError, ServerUnreachableError, callApi } from "../../core/online/api.js";
import { submitToLeaderboard } from "../../core/ui/leaderboard-submit.js";

/** @typedef {import("../../core/storage.js").Account} Account */
/** @typedef {import("./colors.js").TargetLanguage} TargetLanguage */
/** @typedef {"left" | "right" | "shoot" | {to: number}} Action */
/**
 * A round the Worker checks (R8.6): the board comes from its seed, and the commands are recorded.
 * @typedef {{runId: string, seed: number, token: string}} ServerRun
 */

/**
 * @param {Account | null} account
 * @param {TargetLanguage} lang
 * @returns {Promise<ServerRun | null>} Null without an account or when the Worker can't be
 *   reached; the round is then played locally and can't be added to the leaderboard.
 */
export async function startServerRun(account, lang) {
  if (account === null) return null;
  try {
    const { data } = await callApi("POST", "/color-runs", {
      token: account.token,
      body: { lang },
      expect: [201],
    });
    log.debug("server-checked color run", data.runId);
    return { runId: data.runId, seed: data.seed, token: account.token };
  } catch (error) {
    if (!(error instanceof ServerUnreachableError || error instanceof ApiError)) throw error;
    log.info("playing offline: this round can't be added to the leaderboard");
    return null;
  }
}

/**
 * @param {import("../../core/i18n.js").Translate} t
 * @param {ServerRun} run
 * @param {Action[]} actions
 */
export function submitRun(t, run, actions) {
  return submitToLeaderboard(t, async () => {
    const { data } = await callApi("POST", `/color-runs/${run.runId}/finish`, {
      token: run.token,
      body: { actions },
      expect: [200],
    });
    log.info(`added to the leaderboard: ${data.score} points`);
    return null;
  });
}
