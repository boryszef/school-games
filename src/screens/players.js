import { formatTime } from "../core/format.js";
import { registerPlayer } from "../core/online/accounts.js";
import { ApiError, ServerUnreachableError } from "../core/online/api.js";
import { addPlayer, bestTime, missedFacts } from "../core/profiles.js";
import { listGames } from "../core/registry.js";
import { h } from "../core/ui/dom.js";

/** @typedef {import("../core/app.js").App} App */

const MISSED_FACTS_SHOWN = 10;

/** @type {import("../core/app.js").Screen} */
export function renderPlayers(root, app) {
  const { t, data } = app;
  root.replaceChildren(
    h("h1", {}, t("players.title")),
    ...(data.player === null
      ? [h("p", {}, t("players.empty")), _newPlayerButton(app)]
      : [_playerStats(app, data.player.name)]),
  );
  return () => {};
}

/**
 * A browser has one player (R3.1). The Worker picks the nickname, so creating it needs internet.
 * @param {App} app
 */
function _newPlayerButton(app) {
  const button = h(
    "button",
    { type: "button", class: "button secondary" },
    `+ ${app.t("players.new")}`,
  );
  const error = h("p", { class: "form-error", "aria-live": "polite" });
  button.addEventListener("click", async () => {
    button.disabled = true;
    error.textContent = "";
    try {
      const { nickname, account } = await registerPlayer();
      app.update((d) => addPlayer(d, nickname, account));
      _playerCreated(app);
    } catch (caught) {
      if (!(caught instanceof ServerUnreachableError || caught instanceof ApiError)) throw caught;
      error.textContent = app.t("players.serverUnreachable");
      button.disabled = false;
    }
  });
  return h("div", { class: "player-new" }, button, error);
}

/**
 * Goes back to the page that asked for a player, or shows the new player's stats.
 * @param {App} app
 */
function _playerCreated(app) {
  const target = app.returnHash;
  app.returnHash = null;
  if (target === null) app.refresh();
  else app.navigate(target);
}

/**
 * @param {App} app
 * @param {string} name
 */
function _playerStats(app, name) {
  const { t, data } = app;
  return h(
    "section",
    { class: "player-stats" },
    h("h2", {}, name),
    ...listGames().map((game) => {
      const best = bestTime(data, game.id);
      const missed = missedFacts(data, game.id).slice(0, MISSED_FACTS_SHOWN);
      return h(
        "article",
        { class: "game-stats" },
        h("h3", {}, game.icon, " ", t(game.titleKey)),
        h(
          "p",
          {},
          best === null ? t("players.noRuns") : t("players.bestTime", { time: formatTime(best) }),
        ),
        missed.length === 0 ? "" : h("p", {}, t("players.missed")),
        missed.length === 0
          ? ""
          : h(
              "ul",
              { class: "missed-facts" },
              ...missed.map((f) =>
                h("li", {}, t("players.missedFact", { a: f.row, b: f.col, count: f.count })),
              ),
            ),
        h("a", { href: `#/game/${game.id}`, class: "button" }, t("players.play")),
      );
    }),
  );
}
