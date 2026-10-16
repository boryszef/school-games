import assert from "node:assert/strict";
import { createTestDb } from "./d1.js";
import { createApp } from "../../worker/src/app.js";

/** @typedef {{id: string, token: string, nickname: string}} TestPlayer */

/** Wednesday 2026-10-14 12:00 UTC. */
const WEDNESDAY_NOON = Date.UTC(2026, 9, 14, 12);

/**
 * The Worker app on an in-memory database, with a clock the test moves.
 * @param {number} [start]
 */
export function workerSetup(start = WEDNESDAY_NOON) {
  let clock = start;
  const db = createTestDb();
  const app = createApp({
    db,
    now: () => clock,
    randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size)),
  });

  /**
   * @param {string} method
   * @param {string} path
   * @param {{body?: unknown, token?: string, authorization?: string}} [options]
   */
  const call = (method, path, { body, token, authorization } = {}) => {
    /** @type {Record<string, string>} */
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token !== undefined) headers.authorization = `Bearer ${token}`;
    if (authorization !== undefined) headers.authorization = authorization;
    return app.handle(
      new Request(`https://worker.test${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  };

  /** @returns {Promise<TestPlayer>} */
  const newPlayer = async () => {
    const response = await call("POST", "/players");
    assert.equal(response.status, 201);
    return response.json();
  };

  return {
    db,
    call,
    newPlayer,
    advance: (/** @type {number} */ ms) => (clock += ms),
    setTime: (/** @type {number} */ ms) => (clock = ms),
  };
}
