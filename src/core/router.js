/**
 * @typedef {{name: "home"} | {name: "players"} | {name: "game", id: string} | {name: "notFound"}} Route
 */

/** @type {Record<string, Route>} */
const STATIC_ROUTES = {
  "": { name: "home" },
  "#/": { name: "home" },
  "#/players": { name: "players" },
};

const GAME_ROUTE = /^#\/game\/([\w-]+)$/;

/**
 * @param {string} hash `location.hash`
 * @returns {Route}
 */
export function parseRoute(hash) {
  if (hash in STATIC_ROUTES) return STATIC_ROUTES[hash];
  const game = GAME_ROUTE.exec(hash);
  return game ? { name: "game", id: game[1] } : { name: "notFound" };
}
