import { listGames } from "../core/registry.js";
import { h } from "../core/ui/dom.js";

/**
 * The order of the groups on the home screen (R1.8).
 * @type {import("../core/registry.js").Subject[]}
 */
const SUBJECTS = ["math", "languages"];

/** @type {import("../core/app.js").Screen} */
export function renderHome(root, app) {
  const { t, data } = app;
  const notice =
    data.player === null
      ? h(
          "p",
          { class: "notice" },
          t("home.noPlayer"),
          " ",
          h("a", { href: "#/players" }, t("home.choosePlayer")),
        )
      : "";
  const groups = SUBJECTS.map((subject) => {
    const tiles = listGames()
      .filter((game) => game.subject === subject)
      .map((game) =>
        h(
          "a",
          { class: "game-tile", href: `#/game/${game.id}` },
          h("span", { class: "game-icon" }, game.icon),
          h("span", {}, t(game.titleKey)),
        ),
      );
    return h(
      "section",
      { class: "game-group" },
      h("h2", { class: "game-group-title" }, t(`home.subject.${subject}`)),
      h("div", { class: "game-grid" }, ...tiles),
    );
  });

  root.replaceChildren(h("h1", { class: "home-title" }, t("home.title")), notice, ...groups);
  return () => {};
}
