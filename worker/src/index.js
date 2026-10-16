import { createApp } from "./app.js";

/**
 * @typedef {object} Env
 * @property {import("./db.js").Db} DB
 * @property {RateLimit} ROOMS_LIMIT
 * @property {RateLimit} PLAYERS_LIMIT
 * @property {string} [DEV_ORIGINS] Comma-separated origins of the local pages; set only by
 *   `npm run dev`, never on the deployed Worker.
 */
/** @typedef {{limit: (options: {key: string}) => Promise<{success: boolean}>}} RateLimit */

const PUBLISHED_ORIGIN = "https://boryszef.github.io";
/**
 * Creating rooms and players is limited per IP, without storing the IP.
 * @type {Map<string, "ROOMS_LIMIT" | "PLAYERS_LIMIT">}
 */
const LIMITS = new Map([
  ["POST /rooms", "ROOMS_LIMIT"],
  ["POST /players", "PLAYERS_LIMIT"],
]);

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   */
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (!isAllowedOrigin(origin, env)) {
      return new Response(null, { status: 403 });
    }
    const cors = origin === null ? {} : _corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!(await _withinLimit(request, env))) {
      return new Response(null, { status: 429, headers: cors });
    }

    const app = createApp({
      db: env.DB,
      now: Date.now,
      randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size)),
    });
    const response = await app.handle(request);
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
    return response;
  },
};

/**
 * Requests without an Origin header (curl, other servers) aren't from a browser page, so CORS
 * doesn't apply to them.
 * @param {string | null} origin
 * @param {Pick<Env, "DEV_ORIGINS">} env
 */
export function isAllowedOrigin(origin, env) {
  if (origin === null || origin === PUBLISHED_ORIGIN) return true;
  return env.DEV_ORIGINS !== undefined && env.DEV_ORIGINS.split(",").includes(origin);
}

/** @param {string} origin */
function _corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function _withinLimit(request, env) {
  const binding = LIMITS.get(`${request.method} ${new URL(request.url).pathname}`);
  if (binding === undefined) return true;
  // Cloudflare always sets this header, also in `wrangler dev`.
  const ip = /** @type {string} */ (request.headers.get("CF-Connecting-IP"));
  const { success } = await env[binding].limit({ key: ip });
  return success;
}
