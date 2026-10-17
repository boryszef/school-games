import { log } from "../log.js";
import { ApiError, ServerUnreachableError, callApi } from "./api.js";

/** @typedef {import("../storage.js").Account} Account */
/**
 * A round the Worker checks (R8.4, R8.6): the game is built from the Worker's seed, the player's
 * actions are recorded, and the Worker replays them when the round is finished.
 * @typedef {{path: string, runId: string, seed: number, token: string}} ServerRun
 */

/**
 * @param {Account | null} account
 * @param {string} path The game's runs, such as `/maze-runs`.
 * @param {object} body What the game needs to start, such as the level.
 * @returns {Promise<ServerRun | null>} Null without an account or when the Worker can't be
 *   reached; the round is then played locally and can't be added to the leaderboard.
 */
export async function startServerRun(account, path, body) {
  if (account === null) return null;
  try {
    const { data } = await callApi("POST", path, { token: account.token, body, expect: [201] });
    log.debug("server-checked run", path, data.runId);
    return { path, runId: data.runId, seed: data.seed, token: account.token };
  } catch (error) {
    if (!(error instanceof ServerUnreachableError || error instanceof ApiError)) throw error;
    log.info("playing offline: this round can't be added to the leaderboard");
    return null;
  }
}

/**
 * Sends the recorded actions for the Worker to replay.
 * @param {ServerRun} run
 * @param {unknown[]} actions
 * @returns {Promise<any>} The Worker's result, such as the leaderboard time.
 * @throws {ServerUnreachableError | ApiError}
 */
export async function finishServerRun(run, actions) {
  const { data } = await callApi("POST", `${run.path}/${run.runId}/finish`, {
    token: run.token,
    body: { actions },
    expect: [200],
  });
  log.info("added to the leaderboard", data);
  return data;
}
