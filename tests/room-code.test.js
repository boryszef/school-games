import { test } from "node:test";
import assert from "node:assert/strict";
import { InvalidRoomCodeError, parseRoomCode } from "../src/core/net/room-code.js";

test("a typed code is accepted in any case and with spaces", () => {
  assert.equal(parseRoomCode("K7P2QX"), "K7P2QX");
  assert.equal(parseRoomCode(" k7p 2qx \n"), "K7P2QX");
});

test("a whole invitation link gives its code", () => {
  const link = "https://boryszef.github.io/school-games/#/game/tug-of-war/join/K7P2QX";
  assert.equal(parseRoomCode(link), "K7P2QX");
  assert.equal(parseRoomCode(` ${link.toLowerCase()} `), "K7P2QX");
});

test("anything else is not a room code", () => {
  const invalid = ["", "   ", "K7P2Q", "K7P2QXA", "K0P2QX", "KOP2QX", "K1P2QX", "KIP2QX", "KLP2QX"];
  for (const input of [...invalid, "https://example.com/#/game/tug-of-war/join/"]) {
    assert.throws(() => parseRoomCode(input), InvalidRoomCodeError, `accepted "${input}"`);
  }
});
