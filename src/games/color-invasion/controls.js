import { h } from "../../core/ui/dom.js";

/** @typedef {"left" | "right" | "shoot"} Command */

/** @type {Record<string, Command>} */
const KEY_COMMANDS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  a: "left",
  d: "right",
  " ": "shoot",
};

/**
 * ←/→ or A/D move the ship and Space shoots.
 * @param {(command: Command) => void} onCommand
 * @returns {() => void} Stops listening.
 */
export function listenForKeys(onCommand) {
  /** @param {KeyboardEvent} event */
  const onKey = (event) => {
    const command = KEY_COMMANDS[event.key];
    if (command === undefined) return;
    event.preventDefault();
    onCommand(command);
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}

/**
 * The on-screen 🔥 button; the ship moves by tapping a column (R9.4). It doesn't take focus, so
 * Space never also presses it.
 * @param {import("../../core/i18n.js").Translate} t
 * @param {(command: Command) => void} onCommand
 */
export function createControls(t, onCommand) {
  return h(
    "div",
    { class: "ci-controls" },
    h(
      "button",
      {
        type: "button",
        class: "ci-control ci-shoot",
        "aria-label": t("colorInvasion.shoot"),
        onmousedown: (event) => event.preventDefault(),
        onclick: () => onCommand("shoot"),
      },
      "🔥",
    ),
  );
}
