import { log } from "../log.js";
import { decodeDescription } from "./sdp-code.js";

/**
 * Hands an answer code from the tab that opened the answer link to the host's waiting game tab
 * in the same browser.
 */

const CHANNEL_NAME = "school-games-answers";
const ACK_TIMEOUT_MS = 1000;

/**
 * Host tab: receives answer codes for its invitation and confirms them.
 * @param {string} sessionId
 * @param {(answerCode: string) => void} onCode
 * @returns {() => void} Stops listening.
 */
export function listenForAnswer(sessionId, onCode) {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener("message", (event) => {
    const { kind, sessionId: target, code } = event.data;
    if (kind !== "answer" || target !== sessionId || typeof code !== "string") return;
    log.debug("answer received from another tab");
    channel.postMessage({ kind: "ack", sessionId });
    onCode(code);
  });
  return () => channel.close();
}

/**
 * Answer tab: sends the code to the waiting host tab.
 * @param {string} answerCode
 * @returns {Promise<boolean>} Whether a host tab took it.
 * @throws {import("./sdp-code.js").InvalidCodeError}
 */
export function deliverAnswer(answerCode) {
  const { sessionId } = decodeDescription(answerCode);
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return new Promise((resolve) => {
    /** @param {boolean} delivered */
    const finish = (delivered) => {
      clearTimeout(timer);
      channel.close();
      resolve(delivered);
    };
    const timer = setTimeout(() => finish(false), ACK_TIMEOUT_MS);
    channel.addEventListener("message", (event) => {
      if (event.data.kind === "ack" && event.data.sessionId === sessionId) finish(true);
    });
    channel.postMessage({ kind: "answer", sessionId, code: answerCode });
  });
}
