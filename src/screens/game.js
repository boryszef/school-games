import { log } from "../core/log.js";
import { bestTime, recordRun } from "../core/profiles.js";
import { getGame } from "../core/registry.js";
import { renderNotFound } from "./not-found.js";

/** @type {import("../core/app.js").Screen} */
export function renderGameScreen(root, app, route) {
  const game = route.name === "game" ? getGame(route.id) : undefined;
  if (game === undefined) return renderNotFound(root, app, route);

  const { player } = app.data;
  if (player === null) {
    app.returnHash = location.hash;
    app.navigate("#/players");
    return () => {};
  }

  log.info(`starting ${game.id} for player ${player.name}`);
  root.replaceChildren();
  return game.mount(root, {
    player: { name: player.name, account: player.account ?? null },
    t: app.t,
    recordRun: (result) =>
      app.update((d) =>
        recordRun(d, {
          ...result,
          gameId: game.id,
          finishedAt: new Date().toISOString(),
        }),
      ),
    bestTimeMs: () => bestTime(app.data, game.id),
    exit: () => app.navigate("#/"),
    arg: route.name === "game" ? route.arg : null,
  });
}
