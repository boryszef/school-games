import { h } from "./dom.js";

/**
 * A card over the dimmed game, such as a round's result (styles in `css/base.css`).
 * @param {...(Node | string)} children
 */
export function createOverlayCard(...children) {
  return h("div", { class: "overlay" }, h("div", { class: "overlay-card" }, ...children));
}
