import { test } from "node:test";
import assert from "node:assert/strict";
import { translate } from "../src/core/i18n.js";
import pl from "../src/i18n/pl.js";
import en from "../src/i18n/en.js";
import { messages as mazeMessages } from "../src/games/robot-maze/i18n.js";
import { messages as tugMessages } from "../src/games/tug-of-war/i18n.js";
import { messages as colorMessages } from "../src/games/color-invasion/i18n.js";
import { messages as pirateMessages } from "../src/games/pirate-loot/i18n.js";

/** @param {Record<string, string>} dict */
const keys = (dict) => Object.keys(dict).sort();

test("core dictionaries define the same keys in pl and en", () => {
  assert.deepEqual(keys(pl), keys(en));
});

test("robot-maze dictionaries define the same keys in pl and en", () => {
  assert.deepEqual(keys(mazeMessages.pl), keys(mazeMessages.en));
});

test("tug-of-war dictionaries define the same keys in pl and en", () => {
  assert.deepEqual(keys(tugMessages.pl), keys(tugMessages.en));
});

test("color-invasion dictionaries define the same keys in pl and en", () => {
  assert.deepEqual(keys(colorMessages.pl), keys(colorMessages.en));
});

test("pirate-loot dictionaries define the same keys in pl and en", () => {
  assert.deepEqual(keys(pirateMessages.pl), keys(pirateMessages.en));
});

test("translate substitutes named parameters", () => {
  assert.equal(translate({ q: "{a} × {b} = ?" }, "q", { a: 7, b: 8 }), "7 × 8 = ?");
});

test("translate returns plain strings unchanged", () => {
  assert.equal(translate({ hi: "Cześć" }, "hi"), "Cześć");
});

test("translate throws on a missing key", () => {
  assert.throws(() => translate({}, "nope"), /nope/);
});
