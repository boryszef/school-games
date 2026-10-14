import { listGames } from "../core/registry.js";
import { h } from "../core/ui/dom.js";

/** @type {import("../core/app.js").Screen} */
export function renderHome(root, app) {
  const { t, data } = app;
  const notice =
    data.currentPlayerId === null
      ? h(
          "p",
          { class: "notice" },
          t("home.noPlayer"),
          " ",
          h("a", { href: "#/players" }, t("home.choosePlayer")),
        )
      : "";
  const tiles = listGames().map((game) =>
    h(
      "a",
      { class: "game-tile", href: `#/game/${game.id}` },
      h("span", { class: "game-icon" }, game.icon),
      h("span", {}, t(game.titleKey)),
    ),
  );

  root.replaceChildren(
    h("h1", {}, t("home.title")),
    notice,
    h("div", { class: "game-grid" }, ...tiles),
  );
  return () => {};
}
