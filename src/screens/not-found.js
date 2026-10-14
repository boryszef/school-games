import { h } from "../core/ui/dom.js";

/** @type {import("../core/app.js").Screen} */
export function renderNotFound(root, app) {
  root.replaceChildren(
    h("h1", {}, app.t("notFound.title")),
    h("a", { href: "#/", class: "button" }, app.t("notFound.back")),
  );
  return () => {};
}
