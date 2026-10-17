import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./helpers/dom.js";
import { createRng } from "../src/core/random.js";
import { createBoard } from "../src/games/color-invasion/board.js";
import { createRound, moveShip, shoot } from "../src/games/color-invasion/state.js";

beforeEach(() => {
  installDom();
});

/** @param {HTMLElement} element */
const boxesOf = (element) =>
  [...element.querySelectorAll(".ci-column")].map((c) => [...c.children]);

test("moving the ship keeps the box elements, so a running animation isn't restarted", () => {
  const state = createRound(createRng(1));
  const board = createBoard(state.columns.length, () => {});
  board.update(state);
  const before = boxesOf(board.element);
  board.update(moveShip(state, "left"));
  const after = boxesOf(board.element);
  after.forEach((boxes, i) => boxes.forEach((box, j) => assert.equal(box, before[i][j])));
});

test("a shot column shows its new number of boxes", () => {
  const round = createRound(createRng(1));
  const aimed = { ...round, target: round.columns[round.shipColumn].color };
  const board = createBoard(round.columns.length, () => {});
  board.update(aimed);
  const { state } = shoot(aimed, createRng(2));
  board.update(state);
  assert.equal(
    boxesOf(board.element)[round.shipColumn].length,
    state.columns[round.shipColumn].boxes,
  );
});
