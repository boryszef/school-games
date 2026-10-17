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
 * On-screen ◀ 🔥 ▶ buttons. They don't take focus, so Space never also presses one.
 * @param {import("../../core/i18n.js").Translate} t
 * @param {(command: Command) => void} onCommand
 */
export function createControls(t, onCommand) {
  /** @type {[Command, string, string][]} */
  const buttons = [
    ["left", "◀", t("dpad.left")],
    ["shoot", "🔥", t("colorInvasion.shoot")],
    ["right", "▶", t("dpad.right")],
  ];
  return h(
    "div",
    { class: "ci-controls" },
    ...buttons.map(([command, label, name]) =>
      h(
        "button",
        {
          type: "button",
          class: `ci-control ci-${command}`,
          "aria-label": name,
          onmousedown: (event) => event.preventDefault(),
          onclick: () => onCommand(command),
        },
        label,
      ),
    ),
  );
}
