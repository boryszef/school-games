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
 * @property {string} gameId
 * @property {string} finishedAt ISO date
 * @property {number} timeMs Total time, penalties included.
 * @property {number} penaltyMs
 * @property {[number, number][]} mistakes `[row, col]` of each wrong answer.
 */
/**
 * @typedef {object} AppData
 * @property {string} lang
 * @property {Player | null} player The browser's one player; null until it is created.
 * @property {Run[]} runs
 */
/** @typedef {Pick<Storage, "getItem" | "setItem">} KeyValueStore */

export const STORAGE_KEY = "schoolGames";
const VERSION = 2;

/** @returns {AppData} */
export function emptyData() {
  return { lang: "pl", player: null, runs: [] };
}

/**
 * @param {KeyValueStore} store
 * @returns {AppData}
 */
export function loadData(store) {
  const raw = store.getItem(STORAGE_KEY);
  if (raw === null) return emptyData();
  const stored = JSON.parse(raw);
  /** @type {AppData} */
  let data;
  if (stored.version === 1) data = _fromVersion1(stored.data);
  else if (stored.version === VERSION) data = stored.data;
  else throw new Error(`Unsupported storage version ${stored.version}, expected ${VERSION}`);
  log.debug("data loaded", { player: data.player?.name ?? null, runs: data.runs.length });
  return data;
}

/**
 * @param {KeyValueStore} store
 * @param {AppData} data
 */
export function saveData(store, data) {
  store.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, data }));
}

/**
 * Version 1 could hold several players. Keeps the selected one, or the first, with their runs.
 * @param {{lang: string, currentPlayerId: string | null, players: Record<string, Player>,
 *   runs: (Run & {playerId: string})[]}} data
 * @returns {AppData}
 */
function _fromVersion1(data) {
  const id = data.currentPlayerId ?? Object.keys(data.players)[0] ?? null;
  const dropped = Object.entries(data.players).filter(([other]) => other !== id);
  if (dropped.length > 0)
    log.info(
      "dropping other players",
      dropped.map(([, p]) => p.name),
    );
  return {
    lang: data.lang,
    player: id === null ? null : data.players[id],
    runs: data.runs
      .filter((run) => run.playerId === id)
      .map(({ gameId, finishedAt, timeMs, penaltyMs, mistakes }) => ({
        gameId,
        finishedAt,
        timeMs,
        penaltyMs,
        mistakes,
      })),
  };
}
