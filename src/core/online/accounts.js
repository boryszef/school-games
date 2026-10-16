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
 * Gives a player from before nicknames a nickname and an account (R8.2). On failure it is tried
 * again at the next start.
 * @param {() => AppData} getData
 * @param {(change: (data: AppData) => AppData) => void} update
 * @returns {Promise<boolean>} Whether the player was renamed.
 */
export async function registerOldPlayer(getData, update) {
  const { player } = getData();
  if (player === null || player.account !== undefined) return false;
  try {
    const { nickname, account } = await registerPlayer();
    update((data) => setAccount(data, nickname, account));
    log.info(`player ${player.name} is now ${nickname}`);
    return true;
  } catch (error) {
    if (!(error instanceof ServerUnreachableError || error instanceof ApiError)) throw error;
    log.info("could not give the player a nickname yet; trying at the next start");
    return false;
  }
}
