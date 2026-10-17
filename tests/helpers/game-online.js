import { translate } from "../../src/core/i18n.js";
import coreEn from "../../src/i18n/en.js";

/** @typedef {ReturnType<typeof import("./worker.js").workerSetup>} Worker */
/** @typedef {{method: string, path: string, body: any, status: number, data: any}} Exchange */

// api.js picks the Worker's address from the page's host when imported.
Object.assign(globalThis, { location: new URL("http://localhost:8000/") });

/**
 * Sends the game's `fetch` calls to the Worker app on its in-memory database, and records them.
 * @param {Worker} worker
 * @returns {Exchange[]}
 */
export function routeFetchToWorker(worker) {
  /** @type {Exchange[]} */
  const exchanges = [];
  Object.assign(globalThis, {
    /**
     * @param {string} url
     * @param {RequestInit & {headers: Record<string, string>}} init
     */
    fetch: async (url, init) => {
      const { pathname } = new URL(url);
      const token = init.headers.Authorization?.replace("Bearer ", "");
      const body = init.body === undefined ? undefined : JSON.parse(String(init.body));
      const response = await worker.call(String(init.method), pathname, { body, token });
      const data = response.headers.get("Content-Type")?.startsWith("application/json")
        ? await response.clone().json()
        : null;
      exchanges.push({
        method: String(init.method),
        path: pathname,
        body,
        status: response.status,
        data,
      });
      return response;
    },
  });
  return exchanges;
}

/** Makes every request fail as if the device were offline. */
export function goOffline() {
  Object.assign(globalThis, {
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
}

/** Replaces `performance.now`, which the game timers read, with a clock the test moves. */
export function fakeClock() {
  let now = 0;
  Object.defineProperty(performance, "now", { value: () => now, configurable: true });
  return { advance: (/** @type {number} */ ms) => (now += ms) };
}

/**
 * The context a game gets from the platform, with a `exited` flag for "Choose another game".
 * @param {import("../../src/core/i18n.js").Dictionary} messages The game's English dictionary.
 * @param {{name: string, account: {id: string, token: string} | null}} player
 */
export function gameContext(messages, player) {
  const ctx = {
    player,
    /** @type {import("../../src/core/i18n.js").Translate} */
    t: (key, params) => translate({ ...coreEn, ...messages }, key, params),
    recordRun: () => {},
    bestTimeMs: () => null,
    exited: false,
    exit: () => (ctx.exited = true),
    arg: null,
  };
  return ctx;
}

/** Lets pending promise callbacks and short timers run. */
const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits until `ready` holds, such as a request to the in-memory Worker having been answered.
 * @param {() => boolean} ready
 */
export async function until(ready) {
  for (let waited = 0; !ready(); waited += 10) {
    if (waited > 2000) throw new Error("timed out waiting for the game");
    await settle(10);
  }
}
