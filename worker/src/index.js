import { createApp } from "./app.js";

/**
 * @typedef {object} Env
 * @property {import("./db.js").Db} DB
 * @property {RateLimit} ROOMS_LIMIT
 * @property {RateLimit} PLAYERS_LIMIT
 */
/** @typedef {{limit: (options: {key: string}) => Promise<{success: boolean}>}} RateLimit */

const ALLOWED_ORIGINS = ["https://boryszef.github.io", "http://localhost:8000"];
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
    if (origin !== null && !ALLOWED_ORIGINS.includes(origin)) {
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
