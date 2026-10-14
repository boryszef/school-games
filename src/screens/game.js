import { log } from "../core/log.js";
import { bestTime, recordRun } from "../core/profiles.js";
import { getGame } from "../core/registry.js";
import { renderNotFound } from "./not-found.js";

/** @type {import("../core/app.js").Screen} */
export function renderGameScreen(root, app, route) {
  const game = route.name === "game" ? getGame(route.id) : undefined;
  if (game === undefined) return renderNotFound(root, app, route);

  const playerId = app.data.currentPlayerId;
  if (playerId === null) {
    app.navigate("#/players");
    return () => {};
  }

  log.info(`starting ${game.id} for player ${playerId}`);
  root.replaceChildren();
  return game.mount(root, {
    player: { id: playerId, name: app.data.players[playerId].name },
    t: app.t,
    recordRun: (result) =>
      app.update((d) =>
        recordRun(d, {
          ...result,
          playerId,
          gameId: game.id,
          finishedAt: new Date().toISOString(),
        }),
      ),
    bestTimeMs: () => bestTime(app.data, playerId, game.id),
    exit: () => app.navigate("#/"),
  });
}
