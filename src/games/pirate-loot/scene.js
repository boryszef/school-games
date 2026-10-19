import { h } from "../../core/ui/dom.js";
import { createPirate } from "./pirates.js";

/** @typedef {import("../../core/i18n.js").Translate} Translate */
/**
 * What the scene shows; CSS animates the change from one phase to the next (R11.10).
 * @typedef {"sailing" | "docked" | "cheering" | "overboard"} ScenePhase
 */

/** A gold coin, for the chest and the shares. */
const COIN_SVG = `<svg class="pl-coin" viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="10" cy="10" r="9" fill="#f9a825" stroke="#c17900" stroke-width="1.5"/>
  <circle cx="10" cy="10" r="5.5" fill="none" stroke="#c17900" stroke-width="1"/>
</svg>`;

const SHIP_SVG = `<svg class="pl-hull" viewBox="0 0 300 60" preserveAspectRatio="none"
    aria-hidden="true">
  <path d="M0 4 H300 L268 58 H32Z" fill="#8d5524"/>
  <path d="M6 14 H294" stroke="#5d3a16" stroke-width="4"/>
  <g fill="#3e2723">
    <circle cx="80" cy="34" r="5"/><circle cx="150" cy="34" r="5"/><circle cx="220" cy="34" r="5"/>
  </g>
</svg>`;

const RIG_SVG = `<svg class="pl-rig" viewBox="0 0 100 120" aria-hidden="true">
  <rect x="47" y="8" width="5" height="112" fill="#5d3a16"/>
  <path d="M52 14 Q86 40 52 78Z" fill="#fdf5e6" stroke="#d7ccc8"/>
  <path d="M52 8 H82 V26 H52Z" fill="#212121"/>
  <circle cx="67" cy="15" r="3.5" fill="#fafafa"/>
  <path d="M62 21 L72 25 M72 21 L62 25" stroke="#fafafa" stroke-width="1.5"/>
</svg>`;

const ISLAND_SVG = `<svg viewBox="0 0 120 80" aria-hidden="true">
  <ellipse cx="60" cy="72" rx="58" ry="16" fill="#f4d58d"/>
  <path d="M30 70 Q24 40 34 14" stroke="#795548" stroke-width="5" fill="none"/>
  <g fill="#2e7d32">
    <path d="M34 14 Q16 6 4 18 Q20 12 34 14Z"/><path d="M34 14 Q50 2 64 12 Q48 10 34 14Z"/>
    <path d="M34 14 Q22 22 18 36 Q28 22 34 14Z"/><path d="M34 14 Q48 20 52 34 Q42 20 34 14Z"/>
  </g>
</svg>`;

const CHEST_SVG = `<svg viewBox="0 0 48 40" aria-hidden="true">
  <g class="pl-gold"><circle cx="16" cy="16" r="6" fill="#f9a825"/>
    <circle cx="26" cy="13" r="6" fill="#fbc02d"/><circle cx="33" cy="17" r="5" fill="#f9a825"/></g>
  <rect x="4" y="18" width="40" height="20" rx="3" fill="#8d5524" stroke="#4e342e" stroke-width="2"/>
  <rect x="21" y="22" width="6" height="7" rx="1" fill="#ffca28"/>
  <path class="pl-lid" d="M4 18 Q24 2 44 18Z" fill="#a1662f" stroke="#4e342e" stroke-width="2"/>
</svg>`;

const SHARK_SVG = `<svg class="pl-shark" viewBox="0 0 40 24" aria-hidden="true">
  <path d="M4 24 Q22 18 26 0 Q30 16 38 24Z" fill="#607d8b"/>
</svg>`;

/** @param {Translate} t */
export function createScene(t) {
  const deck = h("div", { class: "pl-deck" });
  const treasure = h("p", { class: "pl-treasure" });
  const chest = h("div", { class: "pl-chest" });
  chest.innerHTML = CHEST_SVG;
  chest.append(treasure);
  const island = h("div", { class: "pl-island" });
  island.innerHTML = ISLAND_SVG;
  island.append(chest);
  const ship = h("div", { class: "pl-ship" }, h("div", { class: "pl-plank" }), deck);
  ship.insertAdjacentHTML("afterbegin", RIG_SVG);
  ship.insertAdjacentHTML("beforeend", SHIP_SVG);
  const sea = h("div", { class: "pl-sea" }, h("div", { class: "pl-splash" }));
  sea.insertAdjacentHTML("beforeend", SHARK_SVG);
  const element = h("div", { class: "pl-stage" }, island, ship, sea);

  /** @param {ScenePhase} phase */
  const setPhase = (phase) => (element.dataset.phase = phase);

  return {
    element,
    /**
     * A new crew comes aboard and the ship sets sail; the chest stays closed.
     * @param {number} crew
     * @param {number} coins
     */
    sail(crew, coins) {
      ship.style.setProperty("--crew", String(crew));
      deck.replaceChildren(
        ...Array.from({ length: crew }, (_, i) => {
          const pirate = createPirate(i === 0, Math.random);
          pirate.style.setProperty("--i", String(i));
          return pirate;
        }),
      );
      treasure.innerHTML = `${COIN_SVG}<span>${coins}</span>`;
      chest.setAttribute("aria-label", t("pirateLoot.treasure", { coins }));
      setPhase("sailing");
    },
    /** The ship reaches the island and the chest opens. */
    dock() {
      setPhase("docked");
    },
    /**
     * Each pirate gets an equal pile of coins and cheers.
     * @param {number} share
     */
    deal(share) {
      for (const pirate of deck.children) {
        const pile = h("p", { class: "pl-share" });
        pile.innerHTML = `${COIN_SVG}<span>${share}</span>`;
        pirate.append(pile);
      }
      setPhase("cheering");
    },
    /** The crew gets angry and the captain walks the plank to the sharks. */
    overboard() {
      setPhase("overboard");
    },
  };
}
