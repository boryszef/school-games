import { ApiError, ServerUnreachableError } from "../online/api.js";
import { h } from "./dom.js";

/** @typedef {import("../i18n.js").Translate} Translate */

/**
 * Sends a finished game's score to the leaderboard straight away (R8.3) and shows how it went.
 * @param {Translate} t
 * @param {() => Promise<string | null>} submit Sends the score; may return a line to show
 *   instead of "Added!", such as the leaderboard time.
 * @returns {HTMLElement}
 */
export function submitToLeaderboard(t, submit) {
  const status = h("p", { class: "lb-submit-status", "aria-live": "polite" });
  const retry = h("button", { type: "button", class: "button secondary" }, t("leaderboard.retry"));
  const element = h("div", { class: "lb-submit" }, status);

  const send = async () => {
    retry.remove();
    status.textContent = t("leaderboard.sending");
    try {
      status.textContent = (await submit()) ?? t("leaderboard.added");
    } catch (error) {
      if (!(error instanceof ServerUnreachableError || error instanceof ApiError)) throw error;
      status.textContent = t("leaderboard.failed");
      element.append(retry);
    }
  };
  retry.addEventListener("click", send);
  send();
  return element;
}
