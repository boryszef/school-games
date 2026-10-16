/** @typedef {import("./i18n.js").Translate} Translate */
/** @typedef {import("./i18n.js").Dictionary} Dictionary */
/** @typedef {Pick<import("./storage.js").Run, "timeMs" | "penaltyMs" | "mistakes">} RunResult */
/**
 * @typedef {object} GameContext
 * @property {{name: string, account: import("./storage.js").Account | null}} player
 *   `account` is null until the Worker has registered the player (R8.2).
 * @property {Translate} t
 * @property {(result: RunResult) => void} recordRun
 * @property {() => number | null} bestTimeMs Player's best time before the current run.
 * @property {() => void} exit Leaves the game and returns home.
 * @property {string | null} arg The rest of the route after `#/game/<id>/`, if any.
 */
/**
 * @typedef {object} GameDefinition
 * @property {string} id Used in the URL: `#/game/<id>`.
 * @property {string} titleKey
 * @property {string} icon
 * @property {Record<string, Dictionary>} messages Per-language dictionaries.
 * @property {(root: HTMLElement, ctx: GameContext) => () => void} mount Returns unmount.
 */

/** @type {Map<string, GameDefinition>} */
const games = new Map();

/** @param {GameDefinition} game */
export function registerGame(game) {
  games.set(game.id, game);
}

export function listGames() {
  return [...games.values()];
}

/** @param {string} id */
export function getGame(id) {
  return games.get(id);
}
