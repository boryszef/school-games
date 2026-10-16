import { log } from "../log.js";

const PUBLISHED_HOST = "boryszef.github.io";

/**
 * The School Games Worker (`worker/`). Only the published site uses the production one; a page
 * served from anywhere else uses the local Worker of `npm run dev` on the same host (R1.6).
 * @param {string} hostname The page's host.
 */
export function apiUrlFor(hostname) {
  return hostname === PUBLISHED_HOST
    ? "https://school-games.boryszef.workers.dev"
    : `http://${hostname}:8787`;
}

const API_URL = apiUrlFor(location.hostname);

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
 * @param {{body?: object, token?: string, expect: number[]}} options `token` is the player's
 *   secret for the routes that need one; `expect` lists the statuses the caller handles, and any
 *   other status is an ApiError.
 * @returns {Promise<{status: number, data: any}>} `data` is null for an empty answer.
 * @throws {ServerUnreachableError | ApiError}
 */
export async function callApi(method, path, { body, token, expect }) {
  const what = `${method} ${path}`;
  /** @type {Response} */
  let response;
  try {
    /** @type {Record<string, string>} */
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token !== undefined) headers.Authorization = `Bearer ${token}`;
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
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
