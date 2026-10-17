import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/random.js";
import { COLORS } from "../src/games/color-invasion/colors.js";
import {
  BOXES_PER_COLUMN,
  CLEAR_BONUS,
  createRound,
  moveShip,
  moveShipTo,
  shoot,
} from "../src/games/color-invasion/state.js";

/** @typedef {import("../src/games/color-invasion/state.js").RoundState} RoundState */

const COLOR_IDS = COLORS.map((color) => color.id);

/** @param {RoundState} state */
const colorAboveShip = (state) => state.columns[state.shipColumn].color;

/** @param {RoundState} state Aims the target at the column above the ship. */
const aimed = (state) => ({ ...state, target: colorAboveShip(state) });

/** @param {RoundState} state Aims the target at any other color. */
const misaimed = (state) => ({
  ...state,
  target: /** @type {string} */ (COLOR_IDS.find((id) => id !== colorAboveShip(state))),
});

test("a new round has every color in its own full column, the ship in the middle and no score", () => {
  const state = createRound(createRng(1));
  assert.deepEqual(state.columns.map((c) => c.color).sort(), [...COLOR_IDS].sort());
  assert.ok(state.columns.every((c) => c.boxes === BOXES_PER_COLUMN));
  assert.equal(state.shipColumn, Math.floor(COLOR_IDS.length / 2));
  assert.equal(state.score, 0);
  assert.equal(state.hits, 0);
  assert.equal(state.misses, 0);
  assert.equal(state.clears, 0);
  assert.ok(COLOR_IDS.includes(state.target));
});

test("the column order is shuffled from round to round", () => {
  const orders = new Set(
    [1, 2, 3, 4, 5].map((seed) =>
      createRound(createRng(seed))
        .columns.map((c) => c.color)
        .join(),
    ),
  );
  assert.ok(orders.size > 1);
});

test("the ship moves one column left or right", () => {
  const state = createRound(createRng(1));
  assert.equal(moveShip(state, "left").shipColumn, state.shipColumn - 1);
  assert.equal(moveShip(state, "right").shipColumn, state.shipColumn + 1);
});

test("the ship can't leave the board", () => {
  const atLeft = moveShipTo(createRound(createRng(1)), 0);
  assert.equal(moveShip(atLeft, "left"), atLeft);
  const atRight = moveShipTo(atLeft, COLOR_IDS.length - 1);
  assert.equal(moveShip(atRight, "right"), atRight);
});

test("tapping a column moves the ship there", () => {
  assert.equal(moveShipTo(createRound(createRng(1)), 2).shipColumn, 2);
});

test("hitting the target color pops a box and gives a point", () => {
  const before = aimed(createRound(createRng(1)));
  const { state, outcome } = shoot(before, createRng(2));
  assert.equal(outcome, "hit");
  assert.equal(state.score, 1);
  assert.equal(state.hits, 1);
  assert.equal(state.columns[before.shipColumn].boxes, BOXES_PER_COLUMN - 1);
});

test("hitting another color costs a point, leaves the box and can go below zero", () => {
  const before = misaimed(createRound(createRng(1)));
  const { state, outcome } = shoot(before, createRng(2));
  assert.equal(outcome, "miss");
  assert.equal(state.score, -1);
  assert.equal(state.misses, 1);
  assert.deepEqual(state.columns, before.columns);
});

test("popping the last box of a column gives the bonus and refills it", () => {
  let state = createRound(createRng(1));
  const column = state.shipColumn;
  const color = colorAboveShip(state);
  /** @type {string[]} */
  const outcomes = [];
  for (let i = 0; i < BOXES_PER_COLUMN; i++) {
    const result = shoot(aimed(state), createRng(i));
    state = result.state;
    outcomes.push(result.outcome);
  }
  assert.deepEqual(outcomes, [...Array(BOXES_PER_COLUMN - 1).fill("hit"), "clear"]);
  assert.equal(state.score, BOXES_PER_COLUMN + CLEAR_BONUS);
  assert.equal(state.clears, 1);
  assert.deepEqual(state.columns[column], { color, boxes: BOXES_PER_COLUMN });
});

test("every correct hit picks a new target different from the previous one", () => {
  let state = createRound(createRng(1));
  const rng = createRng(3);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const before = aimed(moveShipTo(state, i % COLOR_IDS.length));
    state = shoot(before, rng).state;
    assert.notEqual(state.target, before.target);
    seen.add(state.target);
  }
  assert.equal(seen.size, COLOR_IDS.length);
});

test("a wrong shot keeps the target until the right color is hit", () => {
  const before = misaimed(createRound(createRng(1)));
  const { state } = shoot(shoot(before, createRng(2)).state, createRng(3));
  assert.equal(state.target, before.target);
});
