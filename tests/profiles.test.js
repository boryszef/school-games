import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyData } from "../src/core/storage.js";
import { addPlayer, bestTime, recordRun, setAccount } from "../src/core/profiles.js";

/**
 * @param {number} timeMs
 * @param {string} [gameId]
 */
const run = (timeMs, gameId = "robot-maze") => ({
  gameId,
  finishedAt: "2026-10-14T12:00:00.000Z",
  timeMs,
  penaltyMs: 0,
});

const account = { id: "i".repeat(22), token: "t".repeat(43) };

test("addPlayer stores the one player without mutating the input", () => {
  const before = emptyData();
  const after = addPlayer(before, "RedFox1", account);
  assert.equal(after.player?.name, "RedFox1");
  assert.deepEqual(after.player?.account, account);
  assert.equal(before.player, null);
});

test("setAccount renames the player to the nickname and keeps everything else", () => {
  const before = recordRun({ ...emptyData(), player: { name: "Ala", createdAt: "x" } }, run(60000));
  const after = setAccount(before, "RedFox1", account);

  assert.deepEqual(after.player, { name: "RedFox1", createdAt: "x", account });
  assert.deepEqual(after.runs, before.runs);
  assert.equal(before.player?.name, "Ala");
  assert.equal(before.player?.account, undefined);
});

test("recordRun appends the run", () => {
  const data = recordRun(emptyData(), run(60000));
  assert.equal(data.runs.length, 1);
  assert.equal(data.runs[0].timeMs, 60000);
});

test("bestTime is the minimum time of the runs in that game", () => {
  let data = emptyData();
  for (const r of [run(90000), run(70000), run(5000, "other")]) {
    data = recordRun(data, r);
  }
  assert.equal(bestTime(data, "robot-maze"), 70000);
});

test("bestTime is null when the game has no runs", () => {
  assert.equal(bestTime(emptyData(), "robot-maze"), null);
});
