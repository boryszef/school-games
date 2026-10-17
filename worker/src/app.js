import { createColorRuns } from "./color-runs.js";
import { createDuels } from "./duels.js";
import { BadRequestError, readObject } from "./http.js";
import { createLeaderboard } from "./leaderboard.js";
import { createMazeRuns } from "./maze-runs.js";
import { createPlayers } from "./players.js";
import { createRooms } from "./rooms.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./http.js").Reply} Reply */
/**
 * @typedef {object} AppDeps
 * @property {Db} db
 * @property {() => number} now Milliseconds since the epoch.
 * @property {(size: number) => Uint8Array} randomBytes
 */
/**
 * @typedef {object} Context
 * @property {Request} request
 * @property {string[]} params The route's captured path parts.
 * @property {string} playerId The calling player; set only on routes that need one.
 */
/** @typedef {(context: Context) => Promise<Reply>} Handler */
/** @typedef {{method: string, path: RegExp, handler: Handler, player?: true}} Route */

const MAX_SDP_LENGTH = 8192;
/** Free and unlimited. A TURN relay would need a payment card on file, so there is none. */
const ICE_SERVERS = [{ urls: "stun:stun.cloudflare.com:3478" }];

/**
 * The Worker's API, independent of the Cloudflare runtime.
 * @param {AppDeps} deps
 */
export function createApp(deps) {
  const rooms = createRooms(deps);
  const players = createPlayers(deps);
  const mazeRuns = createMazeRuns(deps);
  const colorRuns = createColorRuns(deps);
  const duels = createDuels({ ...deps, playerExists: players.exists });
  const leaderboard = createLeaderboard(deps);

  /** @type {Route[]} */
  const routes = [
    {
      method: "POST",
      path: /^\/rooms$/,
      handler: async ({ request }) => rooms.create(await _sdpField(request, "offer")),
    },
    {
      method: "GET",
      path: /^\/rooms\/([^/]+)$/,
      handler: async ({ params: [code] }) => rooms.offer(code),
    },
    {
      method: "PUT",
      path: /^\/rooms\/([^/]+)\/answer$/,
      handler: async ({ request, params: [code] }) =>
        rooms.answer(code, await _sdpField(request, "answer")),
    },
    {
      method: "GET",
      path: /^\/rooms\/([^/]+)\/answer$/,
      handler: async ({ params: [code] }) => rooms.takeAnswer(code),
    },
    {
      method: "GET",
      path: /^\/ice-servers$/,
      handler: async () => ({ status: 200, body: { iceServers: ICE_SERVERS } }),
    },
    { method: "POST", path: /^\/players$/, handler: () => players.create() },
    {
      method: "POST",
      path: /^\/maze-runs$/,
      player: true,
      handler: async ({ request, playerId }) => mazeRuns.start(playerId, await readObject(request)),
    },
    {
      method: "POST",
      path: /^\/maze-runs\/([^/]+)\/finish$/,
      player: true,
      handler: async ({ request, params: [runId], playerId }) =>
        mazeRuns.finish(playerId, runId, await readObject(request)),
    },
    {
      method: "POST",
      path: /^\/color-runs$/,
      player: true,
      handler: async ({ request, playerId }) =>
        colorRuns.start(playerId, await readObject(request)),
    },
    {
      method: "POST",
      path: /^\/color-runs\/([^/]+)\/finish$/,
      player: true,
      handler: async ({ request, params: [runId], playerId }) =>
        colorRuns.finish(playerId, runId, await readObject(request)),
    },
    {
      method: "POST",
      path: /^\/duels$/,
      player: true,
      handler: async ({ request, playerId }) => duels.report(playerId, await readObject(request)),
    },
    { method: "GET", path: /^\/leaderboard$/, handler: () => leaderboard.get() },
  ];

  return {
    /**
     * @param {Request} request
     * @returns {Promise<Response>}
     */
    async handle(request) {
      const { pathname } = new URL(request.url);
      for (const route of routes) {
        const match = route.path.exec(pathname);
        if (request.method !== route.method || match === null) continue;
        const playerId = route.player ? await players.authenticate(request) : "";
        if (playerId === null) return _respond({ status: 401 });
        try {
          return _respond(await route.handler({ request, params: match.slice(1), playerId }));
        } catch (error) {
          if (!(error instanceof BadRequestError)) throw error;
          return _respond({ status: 400, body: { error: error.message } });
        }
      }
      return _respond({ status: 404 });
    },
  };
}

/**
 * @param {Request} request
 * @param {string} name
 * @returns {Promise<string>}
 * @throws {BadRequestError}
 */
async function _sdpField(request, name) {
  const value = (await readObject(request))[name];
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SDP_LENGTH) {
    throw new BadRequestError(`"${name}" must be a text of 1 to ${MAX_SDP_LENGTH} characters`);
  }
  return value;
}

/** @param {Reply} reply */
function _respond({ status, body, headers }) {
  return body === undefined
    ? new Response(null, { status, headers })
    : Response.json(body, { status, headers });
}
