import { h } from "../../core/ui/dom.js";
import { COLORS } from "./colors.js";
import { BOXES_PER_COLUMN } from "./state.js";

/** @typedef {import("./state.js").RoundState} RoundState */
/** @typedef {import("./state.js").ShotOutcome} ShotOutcome */

const CSS_COLORS = new Map(COLORS.map((color) => [color.id, color.css]));

/**
 * The boxes hang from the top of each column, the ship sits below them.
 * @param {number} columnCount
 * @param {(column: number) => void} onColumnTap
 */
export function createBoard(columnCount, onColumnTap) {
  const columns = Array.from({ length: columnCount }, (_, i) =>
    h("div", { class: "ci-column", onclick: () => onColumnTap(i) }),
  );
  const shipCells = Array.from({ length: columnCount }, (_, i) =>
    h("div", { class: "ci-ship-cell", onclick: () => onColumnTap(i) }),
  );
  const ship = h("span", { class: "ci-ship" }, "🚀");
  const element = h(
    "div",
    { class: "ci-board", style: `--columns: ${columnCount}; --boxes: ${BOXES_PER_COLUMN}` },
    ...columns,
    ...shipCells,
  );

  return {
    element,
    /** @param {RoundState} state */
    update(state) {
      state.columns.forEach(({ color, boxes }, i) => {
        // Unchanged columns keep their elements, or a running refill/shake would restart.
        if (columns[i].children.length === boxes) return;
        const box = () =>
          h("div", { class: "ci-box", style: `background: ${CSS_COLORS.get(color)}` });
        columns[i].replaceChildren(...Array.from({ length: boxes }, box));
      });
      shipCells[state.shipColumn].append(ship);
    },
    /**
     * Replays the shot animation on a column; the state has already changed.
     * @param {ShotOutcome} outcome
     * @param {number} column
     */
    flash(outcome, column) {
      const target = columns[column];
      target.classList.remove("is-hit", "is-clear", "is-miss");
      void target.offsetWidth; // restarts the CSS animation
      target.classList.add(`is-${outcome}`);
    },
  };
}
