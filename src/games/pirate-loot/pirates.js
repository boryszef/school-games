import { h } from "../../core/ui/dom.js";

/** @typedef {import("../../core/random.js").Rng} Rng */

const SKINS = ["#f5d0a9", "#e0ac7e", "#b9825a", "#8a5a3b"];
const SHIRTS = ["#c0392b", "#2e86c1", "#27ae60", "#8e44ad", "#d68910", "#566573"];
const BANDANAS = ["#e74c3c", "#3498db", "#f1c40f", "#1abc9c"];
const BEARDS = ["#5d4037", "#212121", "#a1887f", "#e65100"];
const CAPTAIN_COAT = "#7b1f1f";

/**
 * A pirate drawn in SVG. The captain wears a coat and a hat with a skull; the others get a
 * random mix of skin, shirt, headwear, eyepatch and beard, so each crew looks different. Both
 * faces are drawn, and CSS shows the angry one when the crew is angry.
 * @param {boolean} captain
 * @param {Rng} rng Only for looks; the game's own random numbers stay apart from it.
 */
export function createPirate(captain, rng) {
  /** @param {string[]} list */
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const skin = pick(SKINS);
  const shirt = captain ? CAPTAIN_COAT : pick(SHIRTS);
  const headwear = captain || rng() < 0.5 ? _tricorn(captain) : _bandana(pick(BANDANAS));
  const eyepatch = !captain && rng() < 0.35;
  const beard = rng() < 0.5 ? pick(BEARDS) : null;

  const element = h("div", { class: captain ? "pl-pirate is-captain" : "pl-pirate" });
  element.innerHTML = `<svg viewBox="0 0 40 64" aria-hidden="true">
    <rect x="13" y="47" width="5" height="15" rx="2" fill="#3e2723"/>
    <rect x="22" y="47" width="5" height="15" rx="2" fill="#3e2723"/>
    <g class="pl-arms">
      <rect x="4" y="31" width="7" height="14" rx="3.5" fill="${shirt}"/>
      <rect x="29" y="31" width="7" height="14" rx="3.5" fill="${shirt}"/>
    </g>
    <rect x="9" y="29" width="22" height="21" rx="5" fill="${shirt}"/>
    <rect x="9" y="42" width="22" height="3" fill="#212121"/>
    <circle cx="20" cy="20" r="10" fill="${skin}"/>
    ${beard === null ? "" : `<path d="M10.5 21 Q20 38 29.5 21 Q20 28 10.5 21Z" fill="${beard}"/>`}
    <circle cx="16" cy="19" r="1.5" fill="#212121"/>
    ${
      eyepatch
        ? `<path d="M10.5 14 L30 22" stroke="#212121" stroke-width="1"/>
           <rect x="21" y="16.5" width="6" height="5" rx="1.5" fill="#212121"/>`
        : `<circle cx="24" cy="19" r="1.5" fill="#212121"/>`
    }
    <path class="pl-face-happy" d="M15.5 24 Q20 28.5 24.5 24" stroke="#212121" stroke-width="1.5"
      fill="none" stroke-linecap="round"/>
    <g class="pl-face-angry">
      <path d="M13 15 L18 17 M27 15 L22 17" stroke="#212121" stroke-width="1.5"
        stroke-linecap="round"/>
      <path d="M15.5 27 Q20 23 24.5 27" stroke="#212121" stroke-width="1.5" fill="none"
        stroke-linecap="round"/>
    </g>
    ${headwear}
  </svg>`;
  return element;
}

/** @param {boolean} captain With a skull and a bigger brim. */
function _tricorn(captain) {
  return `<path d="M${captain ? 3 : 6} 13 Q20 ${captain ? -6 : -1} ${captain ? 37 : 34} 13
    Q20 8 ${captain ? 3 : 6} 13Z" fill="#212121"/>
    ${captain ? `<circle cx="20" cy="7.5" r="2.2" fill="#fafafa"/>` : ""}`;
}

/** @param {string} color */
function _bandana(color) {
  return `<path d="M10 16 Q20 3 30 16 Q20 12 10 16Z" fill="${color}"/>
    <circle cx="30.5" cy="15" r="2" fill="${color}"/>`;
}
