import { test } from "node:test";
import assert from "node:assert/strict";
import { COLORS, COLOR_NAMES, TARGET_LANGUAGES } from "../src/games/color-invasion/colors.js";

const COLOR_IDS = COLORS.map((color) => color.id);

test("there are ten distinct colors", () => {
  assert.equal(new Set(COLOR_IDS).size, 10);
});

test("English, German and Spanish are the target languages", () => {
  assert.deepEqual(Object.keys(TARGET_LANGUAGES).sort(), ["de", "en", "es"]);
  assert.deepEqual(Object.keys(COLOR_NAMES).sort(), ["de", "en", "es"]);
});

for (const [lang, names] of Object.entries(COLOR_NAMES)) {
  test(`${lang} names every color with a distinct word`, () => {
    assert.deepEqual(Object.keys(names).sort(), [...COLOR_IDS].sort());
    const words = Object.values(names);
    assert.ok(words.every((word) => word.length > 0));
    assert.equal(new Set(words).size, words.length);
  });
}
