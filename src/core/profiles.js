/** @typedef {import("./storage.js").AppData} AppData */
/** @typedef {import("./storage.js").Run} Run */
/** @typedef {import("./storage.js").Account} Account */
/** @typedef {{row: number, col: number, count: number}} MissedFact */

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
 * Wrongly answered `[row, col]` pairs, most frequent first.
 * @param {AppData} data
 * @param {string} gameId
 * @returns {MissedFact[]}
 */
export function missedFacts(data, gameId) {
  /** @type {Map<string, MissedFact>} */
  const facts = new Map();
  for (const [row, col] of _runsOf(data, gameId).flatMap((run) => run.mistakes)) {
    const key = `${row},${col}`;
    const fact = facts.get(key) ?? { row, col, count: 0 };
    facts.set(key, { ...fact, count: fact.count + 1 });
  }
  return [...facts.values()].sort((a, b) => b.count - a.count || a.row - b.row || a.col - b.col);
}

/**
 * @param {AppData} data
 * @param {string} gameId
 */
function _runsOf(data, gameId) {
  return data.runs.filter((run) => run.gameId === gameId);
}
