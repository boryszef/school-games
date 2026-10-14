/**
 * @typedef {{name: "home"} | {name: "players"} | {name: "game", id: string, arg: string | null} | {name: "notFound"}} Route
 */

/** @type {Record<string, Route>} */
const STATIC_ROUTES = {
  "": { name: "home" },
  "#/": { name: "home" },
  "#/players": { name: "players" },
};

/** `#/game/<id>` or `#/game/<id>/<arg>`, where `<arg>` is the rest of the hash. */
const GAME_ROUTE = /^#\/game\/([\w-]+)(?:\/(.+))?$/;

/**
 * @param {string} hash `location.hash`
 * @returns {Route}
 */
export function parseRoute(hash) {
  if (hash in STATIC_ROUTES) return STATIC_ROUTES[hash];
  const game = GAME_ROUTE.exec(hash);
  return game ? { name: "game", id: game[1], arg: game[2] ?? null } : { name: "notFound" };
}
