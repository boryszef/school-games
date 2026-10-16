import { ApiError, ServerUnreachableError } from "../online/api.js";
import { h } from "./dom.js";

/** @typedef {import("../i18n.js").Translate} Translate */

/**
 * "Add your score to the leaderboard?" with Yes and No. Nothing is sent without Yes.
 * @param {Translate} t
 * @param {() => Promise<string | null>} submit Sends the score; may return a line to show
 *   instead of "Added!", such as the leaderboard time.
 * @returns {HTMLElement}
 */
export function createLeaderboardPrompt(t, submit) {
  const status = h("p", { class: "lb-prompt-status", "aria-live": "polite" });
  const yes = h("button", { type: "button", class: "button" }, t("leaderboard.yes"));
  const no = h("button", { type: "button", class: "button secondary" }, t("leaderboard.no"));
  const question = h("p", {}, t("leaderboard.ask"));
  const actions = h("div", { class: "lb-prompt-actions" }, yes, no);
  const element = h("div", { class: "lb-prompt" }, question, actions, status);

  /** @param {boolean} busy */
  const setBusy = (busy) => {
    yes.disabled = busy;
    no.disabled = busy;
  };
  no.addEventListener("click", () => element.remove());
  yes.addEventListener("click", async () => {
    setBusy(true);
    status.textContent = t("leaderboard.sending");
    try {
      const line = await submit();
      question.remove();
      actions.remove();
      status.textContent = line ?? t("leaderboard.added");
    } catch (error) {
      if (!(error instanceof ServerUnreachableError || error instanceof ApiError)) throw error;
      status.textContent = t("leaderboard.failed");
      setBusy(false);
    }
  });
  return element;
}
