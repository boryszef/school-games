/** @typedef {import("./storage.js").AppData} AppData */
/** @typedef {import("./storage.js").Run} Run */
/** @typedef {{row: number, col: number, count: number}} MissedFact */

/**
 * @param {AppData} data
 * @param {string} name
 * @param {string} id
 * @returns {AppData}
 */
export function addPlayer(data, name, id) {
  const player = { name, createdAt: new Date().toISOString() };
  return { ...data, players: { ...data.players, [id]: player } };
}

/**
 * @param {AppData} data
 * @param {string} id
 * @returns {AppData}
 */
export function selectPlayer(data, id) {
  return { ...data, currentPlayerId: id };
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
 * @param {string} playerId
 * @param {string} gameId
 * @returns {number | null}
 */
export function bestTime(data, playerId, gameId) {
  const times = _runsOf(data, playerId, gameId).map((run) => run.timeMs);
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * Wrongly answered `[row, col]` pairs, most frequent first.
 * @param {AppData} data
 * @param {string} playerId
 * @param {string} gameId
 * @returns {MissedFact[]}
 */
export function missedFacts(data, playerId, gameId) {
  /** @type {Map<string, MissedFact>} */
  const facts = new Map();
  for (const [row, col] of _runsOf(data, playerId, gameId).flatMap((run) => run.mistakes)) {
    const key = `${row},${col}`;
    const fact = facts.get(key) ?? { row, col, count: 0 };
    facts.set(key, { ...fact, count: fact.count + 1 });
  }
  return [...facts.values()].sort((a, b) => b.count - a.count || a.row - b.row || a.col - b.col);
}

/**
 * @param {AppData} data
 * @param {string} playerId
 * @param {string} gameId
 */
function _runsOf(data, playerId, gameId) {
  return data.runs.filter((run) => run.playerId === playerId && run.gameId === gameId);
}
