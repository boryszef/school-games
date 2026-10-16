import { log } from "./log.js";

/** @typedef {{id: string, token: string}} Account The player's identity on the Worker. */
/**
 * @typedef {object} Player
 * @property {string} name The generated nickname (a typed name for players from before them).
 * @property {string} createdAt
 * @property {Account} [account] Missing until the Worker has registered the player.
 */
/**
 * @typedef {object} Run
 * @property {string} playerId
 * @property {string} gameId
 * @property {string} finishedAt ISO date
 * @property {number} timeMs Total time, penalties included.
 * @property {number} penaltyMs
 * @property {[number, number][]} mistakes `[row, col]` of each wrong answer.
 */
/**
 * @typedef {object} AppData
 * @property {string} lang
 * @property {string | null} currentPlayerId
 * @property {Record<string, Player>} players
 * @property {Run[]} runs
 */
/** @typedef {Pick<Storage, "getItem" | "setItem">} KeyValueStore */

export const STORAGE_KEY = "schoolGames";
const VERSION = 1;

/** @returns {AppData} */
export function emptyData() {
  return { lang: "pl", currentPlayerId: null, players: {}, runs: [] };
}

/**
 * @param {KeyValueStore} store
 * @returns {AppData}
 */
export function loadData(store) {
  const raw = store.getItem(STORAGE_KEY);
  if (raw === null) return emptyData();
  const stored = JSON.parse(raw);
  if (stored.version !== VERSION) {
    throw new Error(`Unsupported storage version ${stored.version}, expected ${VERSION}`);
  }
  /** @type {AppData} */
  const data = stored.data;
  log.debug("data loaded", { players: Object.keys(data.players).length, runs: data.runs.length });
  return data;
}

/**
 * @param {KeyValueStore} store
 * @param {AppData} data
 */
export function saveData(store, data) {
  store.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, data }));
}
