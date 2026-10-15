import { createRooms } from "./rooms.js";

/** @typedef {import("./db.js").Db} Db */
/** @typedef {import("./rooms.js").Reply} Reply */
/** @typedef {{urls: string | string[], username?: string, credential?: string}} IceServer */
/**
 * @typedef {object} AppDeps
 * @property {Db} db
 * @property {() => number} now Milliseconds since the epoch.
 * @property {(size: number) => Uint8Array} randomBytes
 * @property {() => Promise<IceServer[]>} turn Fresh STUN and TURN servers with credentials.
 */
/** @typedef {(request: Request, params: string[]) => Promise<Reply>} Handler */

const MAX_SDP_LENGTH = 8192;

class BadRequestError extends Error {}

/**
 * The Worker's API, independent of the Cloudflare runtime.
 * @param {AppDeps} deps
 */
export function createApp({ db, now, randomBytes, turn }) {
  const rooms = createRooms({ db, now, randomBytes });

  /** @type {[string, RegExp, Handler][]} */
  const routes = [
    ["POST", /^\/rooms$/, async (request) => rooms.create(await _sdpField(request, "offer"))],
    ["GET", /^\/rooms\/([^/]+)$/, async (_, [code]) => rooms.offer(code)],
    [
      "PUT",
      /^\/rooms\/([^/]+)\/answer$/,
      async (request, [code]) => rooms.answer(code, await _sdpField(request, "answer")),
    ],
    ["GET", /^\/rooms\/([^/]+)\/answer$/, async (_, [code]) => rooms.takeAnswer(code)],
    ["GET", /^\/turn$/, async () => ({ status: 200, body: { iceServers: await turn() } })],
  ];

  return {
    /**
     * @param {Request} request
     * @returns {Promise<Response>}
     */
    async handle(request) {
      const { pathname } = new URL(request.url);
      for (const [method, pattern, handler] of routes) {
        const match = pattern.exec(pathname);
        if (request.method !== method || match === null) continue;
        try {
          return _respond(await handler(request, match.slice(1)));
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
  /** @type {unknown} */
  let body;
  try {
    body = JSON.parse(await request.text());
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new BadRequestError("body is not JSON");
  }
  const value =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? /** @type {Record<string, unknown>} */ (body)[name]
      : undefined;
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SDP_LENGTH) {
    throw new BadRequestError(`"${name}" must be a text of 1 to ${MAX_SDP_LENGTH} characters`);
  }
  return value;
}

/** @param {Reply} reply */
function _respond({ status, body }) {
  return body === undefined ? new Response(null, { status }) : Response.json(body, { status });
}
