import { test } from "node:test";
import assert from "node:assert/strict";
import { ANIMALS, COLORS, formatNickname } from "../src/core/online/nickname.js";

test("a nickname is <Color><Animal><N>", () => {
  assert.equal(formatNickname({ color: 0, animal: 0, number: 1 }), "RedFox1");
  const last = { color: COLORS.length - 1, animal: ANIMALS.length - 1, number: 42 };
  assert.equal(formatNickname(last), `${COLORS.at(-1)}${ANIMALS.at(-1)}42`);
});

test("the word lists are capitalised single words without repeats", () => {
  for (const list of [COLORS, ANIMALS]) {
    assert.ok(list.length >= 10, `${list.length} words`);
    assert.equal(new Set(list).size, list.length);
    for (const word of list) assert.match(word, /^[A-Z][a-z]+$/);
  }
});

test("every color and animal pair reads differently", () => {
  const pairs = COLORS.flatMap((color) => ANIMALS.map((animal) => color + animal));
  assert.equal(new Set(pairs).size, pairs.length);
});
