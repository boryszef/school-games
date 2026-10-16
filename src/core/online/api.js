import { log } from "../log.js";

/** The School Games Worker (`worker/`); `npx wrangler dev` serves it on port 8787. */
const API_URL =
  location.hostname === "localhost"
    ? "http://localhost:8787"
    : "https://school-games.boryszef.workers.dev";

/** The Worker could not be reached at all (offline, DNS, CORS). */
export class ServerUnreachableError extends Error {
  /** @param {string} what */
  constructor(what) {
    super(`Could not reach the game server (${what})`);
    this.name = "ServerUnreachableError";
  }
}

/** The Worker answered with a status the caller does not handle. */
export class ApiError extends Error {
  /**
   * @param {string} what
   * @param {number} status
   */
  constructor(what, status) {
    super(`Unexpected answer from the game server: ${what} → ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * @param {string} method
 * @param {string} path
 * @param {{body?: object, expect: number[]}} options `expect` lists the statuses the caller
 *   handles; any other status is an ApiError.
 * @returns {Promise<{status: number, data: any}>} `data` is null for an empty answer.
 * @throws {ServerUnreachableError | ApiError}
 */
export async function callApi(method, path, { body, expect }) {
  const what = `${method} ${path}`;
  /** @type {Response} */
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // fetch rejects with a TypeError exactly when the request could not be made.
    if (!(error instanceof TypeError)) throw error;
    throw new ServerUnreachableError(what);
  }
  log.debug("api", what, response.status);
  if (!expect.includes(response.status)) throw new ApiError(what, response.status);
  const isJson = response.headers.get("Content-Type")?.startsWith("application/json") === true;
  const data = isJson ? await response.json() : null;
  return { status: response.status, data };
}
