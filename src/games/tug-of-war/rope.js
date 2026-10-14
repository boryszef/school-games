import { h } from "../../core/ui/dom.js";
import { ROPE_TO_WIN } from "./match.js";

/**
 * The rope seen from this player's side: they are always on the left, so their tugs move the
 * knot left (negative positions).
 * @param {string} myName
 */
export function createRope(myName) {
  const knot = h("div", { class: "tw-knot" });
  const opponent = h("span", {}, "…");
  const track = h(
    "div",
    { class: "tw-track" },
    h("div", { class: "tw-goal is-left" }),
    h("div", { class: "tw-goal is-right" }),
    h("div", { class: "tw-line" }),
    knot,
  );
  const element = h(
    "div",
    { class: "tw-rope" },
    h("span", { class: "tw-name is-me" }, "🧒 ", myName),
    track,
    h("span", { class: "tw-name" }, "🧒 ", opponent),
  );
  move(0);

  /** @param {number} position −ROPE_TO_WIN (my side) to ROPE_TO_WIN (their side). */
  function move(position) {
    knot.style.left = `${50 + (position / ROPE_TO_WIN) * 50}%`;
  }

  return {
    element,
    /** @param {string} name */
    setOpponent(name) {
      opponent.textContent = name;
    },
    move,
  };
}
