import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/random.js";
import {
  answerLimitMs,
  createGame,
  retire,
  sailAgain,
  split,
} from "../src/games/pirate-loot/state.js";

/** @typedef {import("../src/games/pirate-loot/state.js").GameState} GameState */

/** @param {GameState} state */
const share = (state) => state.treasure / state.crew;

/**
 * Wins `trips` trips in a row with the right answer after 1 s each.
 * @param {number} seed
 * @param {number} trips
 */
function winTrips(seed, trips) {
  const rng = createRng(seed);
  let state = createGame(rng);
  /** @type {GameState[]} Each trip before its split. */
  const visited = [];
  for (let i = 0; i < trips; i++) {
    if (i > 0) state = sailAgain(state, rng);
    visited.push(state);
    state = split(state, share(state), 1000);
  }
  return { state, rng, visited };
}

test("a new game starts on the first trip with no loot, waiting for the split", () => {
  const state = createGame(createRng(1));
  assert.equal(state.trip, 1);
  assert.equal(state.loot, 0);
  assert.equal(state.status, "splitting");
});

test("crews have 2 to 10 pirates and treasures split evenly into shares of 1 to 10", () => {
  /** @type {Set<number>} */
  const crews = new Set();
  /** @type {Set<number>} */
  const shares = new Set();
  for (let seed = 1; seed <= 500; seed++) {
    const state = createGame(createRng(seed));
    assert.ok(Number.isInteger(share(state)), `${state.treasure} ÷ ${state.crew}`);
    crews.add(state.crew);
    shares.add(share(state));
  }
  assert.deepEqual(
    [...crews].sort((a, b) => a - b),
    [2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(
    [...shares].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

test("a right answer in time adds the captain's share to the loot", () => {
  const state = createGame(createRng(2));
  const after = split(state, share(state), 1000);
  assert.equal(after.status, "choosing");
  assert.equal(after.loot, share(state));
});

test("a right answer at the very last moment still counts", () => {
  const state = createGame(createRng(2));
  assert.equal(split(state, share(state), answerLimitMs(1)).status, "choosing");
});

test("a wrong answer throws the captain overboard and loses the loot", () => {
  const { state, rng } = winTrips(3, 2);
  const next = sailAgain(state, rng);
  const after = split(next, (share(next) % 10) + 1, 1000);
  assert.equal(after.status, "overboard");
  assert.equal(after.loot, 0);
});

test("no answer in time throws the captain overboard", () => {
  const state = createGame(createRng(4));
  assert.equal(split(state, null, answerLimitMs(1)).status, "overboard");
});

test("a right answer too late throws the captain overboard", () => {
  const state = createGame(createRng(4));
  assert.equal(split(state, share(state), answerLimitMs(1) + 1).status, "overboard");
});

test("the crew gives 15 s on the first trip, 1 s less each trip, and never less than 4 s", () => {
  assert.equal(answerLimitMs(1), 15_000);
  assert.equal(answerLimitMs(2), 14_000);
  assert.equal(answerLimitMs(12), 4_000);
  assert.equal(answerLimitMs(13), 4_000);
  assert.equal(answerLimitMs(100), 4_000);
});

test("sailing again starts the next trip and keeps the loot", () => {
  const { state, rng } = winTrips(5, 3);
  const next = sailAgain(state, rng);
  assert.equal(next.trip, 4);
  assert.equal(next.loot, state.loot);
  assert.equal(next.status, "splitting");
});

test("the loot is the sum of the captain's shares", () => {
  const { state, visited } = winTrips(6, 5);
  assert.equal(
    state.loot,
    visited.map(share).reduce((a, b) => a + b),
  );
});

test("a trip never has the same crew and treasure as the trip before", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { visited } = winTrips(seed, 30);
    for (let i = 1; i < visited.length; i++) {
      const [before, now] = [visited[i - 1], visited[i]];
      assert.ok(
        before.crew !== now.crew || before.treasure !== now.treasure,
        `seed ${seed}, trip ${i + 1}`,
      );
    }
  }
});

test("retiring ends the game and keeps the loot", () => {
  const { state } = winTrips(7, 3);
  const after = retire(state);
  assert.equal(after.status, "retired");
  assert.equal(after.loot, state.loot);
});
