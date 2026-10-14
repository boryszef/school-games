import { LANGUAGE_NAMES } from "../core/i18n.js";
import { h } from "../core/ui/dom.js";

/** @typedef {import("../core/app.js").App} App */

/**
 * @param {HTMLElement} header
 * @param {App} app
 */
export function renderHeader(header, app) {
  const { t, data } = app;
  const playerName =
    data.currentPlayerId === null
      ? t("header.choosePlayer")
      : data.players[data.currentPlayerId].name;

  const languages = h(
    "select",
    { class: "language", "aria-label": t("header.language") },
    ...Object.entries(LANGUAGE_NAMES).map(([lang, name]) =>
      h("option", { value: lang, selected: lang === data.lang }, name),
    ),
  );
  languages.addEventListener("change", () => {
    app.update((d) => ({ ...d, lang: languages.value }));
    app.refresh();
  });

  header.replaceChildren(
    h("a", { href: "#/", class: "brand" }, "🎓 ", t("app.title")),
    h("a", { href: "#/players", class: "player-link" }, "👤 ", playerName),
    languages,
  );
}
