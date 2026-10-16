import { log } from "../log.js";
import { setAccount } from "../profiles.js";
import { ApiError, ServerUnreachableError, callApi } from "./api.js";

/** @typedef {import("../storage.js").Account} Account */
/** @typedef {import("../storage.js").AppData} AppData */

/**
 * Creates a player on the Worker, which picks the nickname (R8.1).
 * @returns {Promise<{nickname: string, account: Account}>}
 * @throws {ServerUnreachableError | ApiError}
 */
export async function registerPlayer() {
  const { data } = await callApi("POST", "/players", { expect: [201] });
  log.info(`new player ${data.nickname}`);
  return { nickname: data.nickname, account: { id: data.id, token: data.token } };
}

/**
 * Gives every player from before nicknames a nickname and an account (R8.2). Stops at the first
 * failure; the rest are tried at the next start.
 * @param {() => AppData} getData
 * @param {(change: (data: AppData) => AppData) => void} update
 * @returns {Promise<boolean>} Whether any player was renamed.
 */
export async function registerOldPlayers(getData, update) {
  const waiting = Object.entries(getData().players).filter(([, p]) => p.account === undefined);
  log.debug("players without an account", waiting.length);
  let renamed = false;
  for (const [id, player] of waiting) {
    try {
      const { nickname, account } = await registerPlayer();
      update((data) => setAccount(data, id, nickname, account));
      log.info(`player ${player.name} is now ${nickname}`);
      renamed = true;
    } catch (error) {
      if (!(error instanceof ServerUnreachableError || error instanceof ApiError)) throw error;
      log.info("could not give the older players nicknames yet; trying at the next start");
      break;
    }
  }
  return renamed;
}
