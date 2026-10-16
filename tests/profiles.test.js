import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData } from "../src/core/storage.js";
import { addPlayer, bestTime, missedFacts, recordRun, setAccount } from "../src/core/profiles.js";

/**
 * @param {string} playerId
 * @param {number} timeMs
 * @param {[number, number][]} [mistakes]
 * @param {string} [gameId]
 */
const run = (playerId, timeMs, mistakes = [], gameId = "robot-maze") => ({
  playerId,
  gameId,
  finishedAt: "2026-10-14T12:00:00.000Z",
  timeMs,
  penaltyMs: mistakes.length * 5000,
  mistakes,
});

function withTwoPlayers() {
  return addPlayer(addPlayer(emptyData(), "Ala", "a"), "Olek", "o");
}

test("addPlayer stores the player without mutating the input", () => {
  const before = emptyData();
  const after = addPlayer(before, "Ala", "a");
  assert.equal(after.players.a.name, "Ala");
  assert.deepEqual(before.players, {});
});

test("setAccount renames the player to the nickname and keeps everything else", () => {
  const before = recordRun(withTwoPlayers(), run("a", 60000));
  const account = { id: "i".repeat(22), token: "t".repeat(43) };
  const after = setAccount(before, "a", "RedFox1", account);

  assert.deepEqual(after.players.a, {
    name: "RedFox1",
    createdAt: before.players.a.createdAt,
    account,
  });
  assert.deepEqual(after.players.o, before.players.o);
  assert.deepEqual(after.runs, before.runs);
  assert.equal(before.players.a.name, "Ala");
  assert.equal(before.players.a.account, undefined);
});

test("recordRun appends the run", () => {
  const data = recordRun(withTwoPlayers(), run("a", 60000));
  assert.equal(data.runs.length, 1);
  assert.equal(data.runs[0].timeMs, 60000);
});

test("bestTime is the minimum time of the player's runs in that game", () => {
  let data = withTwoPlayers();
  for (const r of [
    run("a", 90000),
    run("a", 70000),
    run("o", 10000),
    run("a", 5000, [], "other"),
  ]) {
    data = recordRun(data, r);
  }
  assert.equal(bestTime(data, "a", "robot-maze"), 70000);
});

test("bestTime is null when the player has no runs", () => {
  assert.equal(bestTime(withTwoPlayers(), "a", "robot-maze"), null);
});

test("missedFacts ranks the player's mistakes by count", () => {
  let data = withTwoPlayers();
  data = recordRun(
    data,
    run("a", 1, [
      [7, 8],
      [6, 9],
    ]),
  );
  data = recordRun(
    data,
    run("a", 1, [
      [7, 8],
      [3, 4],
    ]),
  );
  data = recordRun(data, run("a", 1, [[7, 8]]));
  data = recordRun(
    data,
    run("o", 1, [
      [3, 4],
      [3, 4],
      [3, 4],
      [3, 4],
    ]),
  );

  const facts = missedFacts(data, "a", "robot-maze");
  assert.deepEqual(facts[0], { row: 7, col: 8, count: 3 });
  assert.deepEqual(
    facts.slice(1).map((f) => f.count),
    [1, 1],
  );
  assert.equal(facts.length, 3);
});

test("missedFacts is empty for a player without mistakes", () => {
  const data = recordRun(withTwoPlayers(), run("a", 1));
  assert.deepEqual(missedFacts(data, "a", "robot-maze"), []);
});
