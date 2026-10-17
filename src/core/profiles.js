/** @typedef {import("./storage.js").AppData} AppData */
/** @typedef {import("./storage.js").Run} Run */
/** @typedef {import("./storage.js").Account} Account */

/**
 * Creates the browser's one player with the nickname and account the Worker registered.
 * @param {AppData} data
 * @param {string} nickname
 * @param {Account} account
 * @returns {AppData}
 */
export function addPlayer(data, nickname, account) {
  return { ...data, player: { name: nickname, createdAt: new Date().toISOString(), account } };
}

/**
 * Gives an existing player the nickname and account the Worker registered.
 * @param {AppData} data
 * @param {string} nickname
 * @param {Account} account
 * @returns {AppData}
 */
export function setAccount(data, nickname, account) {
  if (data.player === null) throw new Error("there is no player to give an account");
  return { ...data, player: { ...data.player, name: nickname, account } };
}

/**
 * @param {AppData} data
 * @param {Run} run
 * @returns {AppData}
 */
export function recordRun(data, run) {
  return { ...data, runs: [...data.runs, run] };
}

/**
 * @param {AppData} data
 * @param {string} gameId
 * @returns {number | null}
 */
export function bestTime(data, gameId) {
  const times = _runsOf(data, gameId).map((run) => run.timeMs);
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * @param {AppData} data
 * @param {string} gameId
 */
function _runsOf(data, gameId) {
  return data.runs.filter((run) => run.gameId === gameId);
}
