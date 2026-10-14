import { h } from "./dom.js";

/** @typedef {import("../i18n.js").Translate} Translate */
/** @typedef {"up" | "down" | "left" | "right"} Direction */

/** @type {[Direction, string][]} */
const BUTTONS = [
  ["up", "▲"],
  ["left", "◀"],
  ["right", "▶"],
  ["down", "▼"],
];

/**
 * On-screen direction pad for touch devices.
 * @param {(dir: Direction) => void} onDirection
 * @param {Translate} t
 */
export function createDpad(onDirection, t) {
  return h(
    "div",
    { class: "dpad" },
    ...BUTTONS.map(([dir, label]) =>
      h(
        "button",
        {
          type: "button",
          class: `dpad-key dpad-${dir}`,
          "aria-label": t(`dpad.${dir}`),
          onclick: () => onDirection(dir),
        },
        label,
      ),
    ),
  );
}
