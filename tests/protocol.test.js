import { test } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidMessageError,
  PROTOCOL_VERSION,
  VersionMismatchError,
  parseGuestMessage,
  parseHostMessage,
} from "../src/games/tug-of-war/protocol.js";

const json = (/** @type {unknown} */ message) => JSON.stringify(message);

test("valid host messages parse", () => {
  const messages = [
    { type: "hello", name: "RedFox1", playerId: "i".repeat(22), version: 2 },
    { type: "hello", name: "RedFox1", playerId: null, version: 2 },
    { type: "start", matchId: "m0-_00000001" },
    { type: "question", round: 3, a: 7, b: 8 },
    { type: "tug", round: 3, winner: "guest", rope: -2 },
    { type: "end", winner: "host" },
  ];
  for (const message of messages) assert.deepEqual(parseHostMessage(json(message)), message);
});

test("valid guest messages parse", () => {
  const messages = [
    { type: "hello", name: "BlueOwl7", playerId: "Ab-_".repeat(5) + "xy", version: 2 },
    { type: "hello", name: "BlueOwl7", playerId: null, version: 2 },
    { type: "answer", round: 1, value: 56, reactionMs: 1834.5 },
  ];
  for (const message of messages) assert.deepEqual(parseGuestMessage(json(message)), message);
});

test("a message meant for the other side is rejected", () => {
  assert.throws(
    () => parseHostMessage(json({ type: "answer", round: 1, value: 56, reactionMs: 900 })),
    InvalidMessageError,
  );
  assert.throws(
    () => parseGuestMessage(json({ type: "start", matchId: "m00000000001" })),
    InvalidMessageError,
  );
});

test("invalid host messages are rejected", () => {
  const invalid = [
    "not json",
    json(null),
    json([]),
    json({ type: "nope" }),
    json({ type: "hello", name: "", playerId: null, version: 2 }),
    json({ type: "hello", name: "x".repeat(21), playerId: null, version: 2 }),
    json({ type: "hello", name: 5, playerId: null, version: 2 }),
    json({ type: "hello", name: "RedFox1", version: 2 }),
    json({ type: "hello", name: "RedFox1", playerId: "short", version: 2 }),
    json({ type: "hello", name: "RedFox1", playerId: "!".repeat(22), version: 2 }),
    json({ type: "hello", name: "RedFox1", playerId: 5, version: 2 }),
    json({ type: "question", round: 0, a: 7, b: 8 }),
    json({ type: "question", round: 1.5, a: 7, b: 8 }),
    json({ type: "question", round: 1, a: 1, b: 8 }),
    json({ type: "question", round: 1, a: 7, b: 11 }),
    json({ type: "question", round: 1, a: 7 }),
    json({ type: "tug", round: 1, winner: "nobody", rope: 0 }),
    json({ type: "tug", round: 1, winner: "host", rope: 6 }),
    json({ type: "end", winner: "both" }),
    json({ type: "start" }),
    json({ type: "start", matchId: "m0000000001" }),
    json({ type: "start", matchId: "m0000000000!" }),
    json({ type: "start", matchId: "m00000000001", extra: true }),
  ];
  for (const raw of invalid) {
    assert.throws(() => parseHostMessage(raw), InvalidMessageError, `accepted ${raw}`);
  }
});

test("invalid guest messages are rejected", () => {
  const invalid = [
    json({ type: "answer", round: 1, value: -1, reactionMs: 900 }),
    json({ type: "answer", round: 1, value: 4.5, reactionMs: 900 }),
    json({ type: "answer", round: 1, value: "56", reactionMs: 900 }),
    json({ type: "answer", round: 1, value: 56, reactionMs: -3 }),
    json({ type: "answer", round: 1, value: 56, reactionMs: null }),
    json({ type: "answer", round: 1, value: 56 }),
  ];
  for (const raw of invalid) {
    assert.throws(() => parseGuestMessage(raw), InvalidMessageError, `accepted ${raw}`);
  }
});

test("the protocol version is 2", () => {
  assert.equal(PROTOCOL_VERSION, 2);
});

test("a hello from a different version of the game is a version mismatch", () => {
  const hellos = [
    { type: "hello", name: "RedFox1", playerId: null, version: 1 },
    { type: "hello", name: "RedFox1", playerId: null, version: 3 },
    { type: "hello", name: "RedFox1", playerId: null, version: "2" },
    { type: "hello", name: "RedFox1", playerId: null },
    { type: "hello", name: "Ala" },
  ];
  for (const hello of hellos) {
    assert.throws(() => parseHostMessage(json(hello)), VersionMismatchError, json(hello));
    assert.throws(() => parseGuestMessage(json(hello)), VersionMismatchError, json(hello));
  }
});

test("other messages without a version are not version mismatches", () => {
  assert.throws(() => parseHostMessage(json({ type: "start" })), InvalidMessageError);
  assert.throws(() => parseGuestMessage(json({ type: "nope", version: 1 })), InvalidMessageError);
});
