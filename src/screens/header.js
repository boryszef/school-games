import { LANGUAGE_NAMES } from "../core/i18n.js";
import { h } from "../core/ui/dom.js";

/** @typedef {import("../core/app.js").App} App */

/**
 * @param {HTMLElement} header
 * @param {App} app
 */
export function renderHeader(header, app) {
  const { t, data } = app;
  const playerName = data.player === null ? t("header.choosePlayer") : data.player.name;

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

  const nav = h(
    "nav",
    { class: "site-nav", id: "site-nav" },
    h(
      "a",
      { href: "#/leaderboard", class: "leaderboard-link", "aria-label": t("header.leaderboard") },
      "🏆",
      h("span", { class: "leaderboard-label" }, t("header.leaderboard")),
    ),
    h("a", { href: "#/players", class: "player-link" }, "👤 ", playerName),
    languages,
  );
  const drawer = _drawer(header, nav, t("header.menu"));
  nav.addEventListener("click", (event) => {
    if (/** @type {HTMLElement} */ (event.target).closest("a")) drawer.close();
  });

  header.replaceChildren(
    h("a", { href: "#/", class: "brand" }, "🎓 ", t("app.title")),
    drawer.toggle,
    nav,
    drawer.backdrop,
  );
}

/**
 * On narrow screens the nav is a drawer opened with the ☰ button (R10.6); the CSS shows it inline
 * on wide ones, where the button and backdrop are hidden.
 * @param {HTMLElement} header
 * @param {HTMLElement} nav
 * @param {string} label
 */
function _drawer(header, nav, label) {
  const toggle = h(
    "button",
    {
      type: "button",
      class: "nav-toggle",
      "aria-label": label,
      "aria-controls": nav.id,
      "aria-expanded": "false",
    },
    "☰",
  );
  const backdrop = h("div", { class: "nav-backdrop" });

  /** @param {KeyboardEvent} event */
  const onKey = (event) => {
    if (event.key === "Escape") close();
  };
  /** @param {boolean} open */
  const setOpen = (open) => {
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) document.addEventListener("keydown", onKey);
    else document.removeEventListener("keydown", onKey);
  };
  const close = () => setOpen(false);

  toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));
  backdrop.addEventListener("click", close);
  return { toggle, backdrop, close };
}
