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

test("empty data defaults to Polish with no players or runs", () => {
  assert.deepEqual(emptyData(), { lang: "pl", currentPlayerId: null, players: {}, runs: [] });
});

test("saved data loads back unchanged", () => {
  const storage = memoryStorage();
  const data = {
    ...emptyData(),
    lang: "en",
    currentPlayerId: "a",
    players: { a: { name: "Ala", createdAt: "x" } },
  };
  saveData(storage, data);
  assert.deepEqual(loadData(storage), data);
});

test("an unknown stored version is an error", () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, data: emptyData() }));
  assert.throws(() => loadData(storage), /version/);
});
