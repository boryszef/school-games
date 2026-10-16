import { test } from "node:test";
import assert from "node:assert/strict";
import { ANIMALS, COLORS } from "../../src/core/online/nickname.js";
import { workerSetup } from "../helpers/worker.js";

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** @param {string} nickname */
function splitNickname(nickname) {
  const match = /^([A-Z][a-z]+)([A-Z][a-z]+)([1-9]\d*)$/.exec(nickname);
  assert.ok(match, `not a nickname: ${nickname}`);
  return { color: match[1], animal: match[2], number: Number(match[3]) };
}

test("a new player gets an id, a token and a <Color><Animal><N> nickname", async () => {
  const { newPlayer } = workerSetup();
  const player = await newPlayer();

  assert.match(player.id, BASE64URL);
  assert.equal(player.id.length, 22);
  assert.match(player.token, BASE64URL);
  assert.equal(player.token.length, 43);
  const { color, animal, number } = splitNickname(player.nickname);
  assert.ok(COLORS.includes(color), color);
  assert.ok(ANIMALS.includes(animal), animal);
  assert.equal(number, 1);
});

test("numbers count up from 1 for each color and animal, so nicknames are unique", async () => {
  const { newPlayer } = workerSetup();
  /** @type {Map<string, number[]>} */
  const numbers = new Map();
  for (let i = 0; i < 600; i++) {
    const { color, animal, number } = splitNickname((await newPlayer()).nickname);
    numbers.set(color + animal, [...(numbers.get(color + animal) ?? []), number]);
  }
  for (const [pair, seen] of numbers) {
    assert.deepEqual(
      seen,
      seen.map((_, i) => i + 1),
      pair,
    );
  }
  assert.ok(numbers.size > 1, "color and animal are random");
});

test("the token is stored only as a hash", async () => {
  const { db, newPlayer } = workerSetup();
  const player = await newPlayer();
  const { results } = await db.prepare("SELECT * FROM players").all();
  assert.equal(results.length, 1);
  assert.equal(results[0].id, player.id);
  assert.ok(!Object.values(results[0]).includes(player.token));
});

test("requests that need a player are refused without the right token", async () => {
  const { call, newPlayer } = workerSetup();
  const player = await newPlayer();
  const other = await newPlayer();
  const bad = [
    {},
    { token: "x".repeat(43) },
    { token: player.id },
    { authorization: player.token },
    { authorization: `Basic ${player.token}` },
    { authorization: "Bearer" },
  ];
  for (const auth of bad) {
    assert.equal((await call("POST", "/maze-runs", auth)).status, 401, JSON.stringify(auth));
    const duel = { matchId: "m00000000001", opponentId: other.id, won: true };
    assert.equal((await call("POST", "/duels", { ...auth, body: duel })).status, 401);
  }
  const start = { token: player.token, body: { level: "standard" } };
  assert.equal((await call("POST", "/maze-runs", start)).status, 201);
});
