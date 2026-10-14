import { h } from "./dom.js";

/** @typedef {import("../i18n.js").Translate} Translate */
/**
 * @typedef {object} NumpadHandlers
 * @property {(digit: string) => void} onDigit
 * @property {() => void} onDelete
 * @property {() => void} onSubmit
 */

/**
 * On-screen number pad for touch devices.
 * @param {NumpadHandlers} handlers
 * @param {Translate} t
 */
export function createNumpad(handlers, t) {
  /**
   * @param {string} label
   * @param {() => void} action
   * @param {Record<string, string>} [extra]
   */
  const key = (label, action, extra = {}) =>
    h("button", { type: "button", class: "numpad-key", onclick: action, ...extra }, label);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) =>
    key(d, () => handlers.onDigit(d)),
  );
  return h(
    "div",
    { class: "numpad" },
    ...digits,
    key("⌫", handlers.onDelete, { "aria-label": t("numpad.delete") }),
    key("0", () => handlers.onDigit("0")),
    key("✓", handlers.onSubmit, {
      "aria-label": t("numpad.submit"),
      class: "numpad-key is-submit",
    }),
  );
}
