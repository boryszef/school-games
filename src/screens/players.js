import { formatTime } from "../core/format.js";
import { addPlayer, bestTime, missedFacts, selectPlayer } from "../core/profiles.js";
import { listGames } from "../core/registry.js";
import { h } from "../core/ui/dom.js";

/** @typedef {import("../core/app.js").App} App */

const MISSED_FACTS_SHOWN = 10;

/** @type {import("../core/app.js").Screen} */
export function renderPlayers(root, app) {
  const { t, data } = app;
  const players = Object.entries(data.players);

  root.replaceChildren(
    h("h1", {}, t("players.title")),
    players.length === 0 ? h("p", {}, t("players.empty")) : _playerList(app),
    _newPlayerForm(app),
    data.currentPlayerId === null ? "" : _playerStats(app, data.currentPlayerId),
  );
  return () => {};
}

/** @param {App} app */
function _playerList(app) {
  const { data } = app;
  return h(
    "ul",
    { class: "player-list" },
    ...Object.entries(data.players).map(([id, player]) =>
      h(
        "li",
        {},
        h(
          "button",
          {
            type: "button",
            class: id === data.currentPlayerId ? "player is-current" : "player",
            onclick: () => {
              app.update((d) => selectPlayer(d, id));
              _playerChosen(app);
            },
          },
          player.name,
        ),
      ),
    ),
  );
}

/** @param {App} app */
function _newPlayerForm(app) {
  const name = h("input", {
    required: true,
    maxlength: 20,
    placeholder: app.t("players.namePlaceholder"),
    "aria-label": app.t("players.namePlaceholder"),
  });
  const form = h(
    "form",
    { class: "player-form" },
    name,
    h("button", { type: "submit" }, app.t("players.add")),
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const trimmed = name.value.trim();
    if (trimmed === "") return;
    const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    app.update((d) => selectPlayer(addPlayer(d, trimmed, id), id));
    _playerChosen(app);
  });
  return form;
}

/**
 * Goes back to the page that asked for a player, or shows the chosen player's stats.
 * @param {App} app
 */
function _playerChosen(app) {
  const target = app.returnHash;
  app.returnHash = null;
  if (target === null) app.refresh();
  else app.navigate(target);
}

/**
 * @param {App} app
 * @param {string} playerId
 */
function _playerStats(app, playerId) {
  const { t, data } = app;
  return h(
    "section",
    { class: "player-stats" },
    h("h2", {}, data.players[playerId].name),
    ...listGames().map((game) => {
      const best = bestTime(data, playerId, game.id);
      const missed = missedFacts(data, playerId, game.id).slice(0, MISSED_FACTS_SHOWN);
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
