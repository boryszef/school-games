import { test } from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY, emptyData, loadData, saveData } from "../src/core/storage.js";

/** Minimal in-memory stand-in for window.localStorage. */
function memoryStorage() {
  const items = new Map();
  return {
    /** @param {string} k */
    getItem: (k) => items.get(k) ?? null,
    /** @param {string} k @param {string} v */
    setItem: (k, v) => void items.set(k, v),
  };
}

test("loading from empty storage returns the empty data set", () => {
  assert.deepEqual(loadData(memoryStorage()), emptyData());
});

test("empty data defaults to Polish with no player or runs", () => {
  assert.deepEqual(emptyData(), { lang: "pl", player: null, runs: [] });
});

test("saved data loads back unchanged", () => {
  const storage = memoryStorage();
  const data = { ...emptyData(), lang: "en", player: { name: "RedFox1", createdAt: "x" } };
  saveData(storage, data);
  assert.deepEqual(loadData(storage), data);
});

/** @param {string} playerId @param {number} timeMs */
const oldRun = (playerId, timeMs) => ({
  playerId,
  gameId: "robot-maze",
  finishedAt: "2026-10-14T12:00:00.000Z",
  timeMs,
  penaltyMs: 0,
  mistakes: [],
});

/**
 * @param {KeyValueStoreLike} storage
 * @param {object} data Version 1 data.
 */
function storeVersion1(storage, data) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data }));
}
/** @typedef {ReturnType<typeof memoryStorage>} KeyValueStoreLike */

const ala = { name: "PinkFox1", createdAt: "a" };
const olek = { name: "YellowWolf1", createdAt: "o" };

test("version 1 data keeps only the selected player and their runs", () => {
  const storage = memoryStorage();
  storeVersion1(storage, {
    lang: "en",
    currentPlayerId: "o",
    players: { a: ala, o: olek },
    runs: [oldRun("a", 1000), oldRun("o", 2000), oldRun("o", 3000)],
  });
  const kept = {
    gameId: "robot-maze",
    finishedAt: "2026-10-14T12:00:00.000Z",
    timeMs: 2000,
    penaltyMs: 0,
    mistakes: [],
  };
  assert.deepEqual(loadData(storage), {
    lang: "en",
    player: olek,
    runs: [kept, { ...kept, timeMs: 3000 }],
  });
});

test("version 1 data without a selected player keeps the first one", () => {
  const storage = memoryStorage();
  storeVersion1(storage, {
    lang: "pl",
    currentPlayerId: null,
    players: { a: ala, o: olek },
    runs: [oldRun("o", 2000)],
  });
  assert.deepEqual(loadData(storage), { lang: "pl", player: ala, runs: [] });
});

test("version 1 data without players has no player", () => {
  const storage = memoryStorage();
  storeVersion1(storage, { lang: "pl", currentPlayerId: null, players: {}, runs: [] });
  assert.deepEqual(loadData(storage), emptyData());
});

test("an unknown stored version is an error", () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, data: emptyData() }));
  assert.throws(() => loadData(storage), /version/);
});
