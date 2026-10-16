import { createApp } from "./app.js";

/**
 * @typedef {object} Env
 * @property {import("./db.js").Db} DB
 * @property {{limit: (options: {key: string}) => Promise<{success: boolean}>}} ROOMS_LIMIT
 */

const ALLOWED_ORIGINS = ["https://boryszef.github.io", "http://localhost:8000"];
/** Creating rooms is limited per IP, without storing the IP. */
const LIMITED = [["POST", "/rooms"]];

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
    if (_isLimited(request) && !(await _withinLimit(request, env))) {
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
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** @param {Request} request */
function _isLimited(request) {
  const { pathname } = new URL(request.url);
  return LIMITED.some(([method, path]) => request.method === method && pathname === path);
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function _withinLimit(request, env) {
  // Cloudflare always sets this header, also in `wrangler dev`.
  const ip = /** @type {string} */ (request.headers.get("CF-Connecting-IP"));
  const { success } = await env.ROOMS_LIMIT.limit({ key: ip });
  return success;
}
