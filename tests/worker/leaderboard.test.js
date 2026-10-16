import { test } from "node:test";
import assert from "node:assert/strict";
import { solveActions } from "../helpers/maze-solver.js";
import { workerSetup } from "../helpers/worker.js";

/** @typedef {import("../helpers/worker.js").TestPlayer} TestPlayer */

/** Sunday 2026-10-11 23:00 UTC, one hour before the week starts. */
const SUNDAY_LATE = Date.UTC(2026, 9, 11, 23);
/** Monday 2026-10-12 10:00 UTC. */
const MONDAY_MORNING = Date.UTC(2026, 9, 12, 10);

/** @param {ReturnType<typeof workerSetup>} worker */
function helpers(worker) {
  /**
   * Plays an honest maze run that takes `ms` on the server's clock.
   * @param {TestPlayer} player
   * @param {number} ms
   * @param {"standard" | "hard"} [level]
   */
  const playMaze = async (player, ms, level = "standard") => {
    const started = await worker.call("POST", "/maze-runs", {
      token: player.token,
      body: { level },
    });
    const { runId, seed } = await started.json();
    worker.advance(ms);
    const finished = await worker.call("POST", `/maze-runs/${runId}/finish`, {
      token: player.token,
      body: { actions: solveActions(seed, { level }) },
    });
    assert.equal(finished.status, 200);
  };
  /**
   * @param {string} matchId
   * @param {TestPlayer} winner
   * @param {TestPlayer} loser
   */
  const duel = async (matchId, winner, loser) => {
    for (const [reporter, opponent, won] of /** @type {const} */ ([
      [winner, loser, true],
      [loser, winner, false],
    ])) {
      const response = await worker.call("POST", "/duels", {
        token: reporter.token,
        body: { matchId, opponentId: opponent.id, won },
      });
      assert.equal(response.status, 202);
    }
  };
  const board = async () => (await worker.call("GET", "/leaderboard")).json();
  return { playMaze, duel, board };
}

test("an empty leaderboard has six empty lists and is never cached", async () => {
  const worker = workerSetup();
  const response = await worker.call("GET", "/leaderboard");
  assert.equal(response.status, 200);
  // A cached copy hid a new record right after it was added.
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    maze: { allTime: [], week: [] },
    mazeHard: { allTime: [], week: [] },
    duels: { allTime: [], week: [] },
  });
});

test("standard and hard maze times are ranked separately", async () => {
  const worker = workerSetup();
  const { playMaze, board } = helpers(worker);
  const [ala, ola] = [await worker.newPlayer(), await worker.newPlayer()];
  await playMaze(ala, 60_000);
  await playMaze(ola, 300_000, "hard");

  const { maze, mazeHard } = await board();
  assert.deepEqual(maze.allTime, [{ nickname: ala.nickname, timeMs: 60_000 }]);
  assert.deepEqual(mazeHard.allTime, [{ nickname: ola.nickname, timeMs: 300_000 }]);
  assert.deepEqual(mazeHard.week, mazeHard.allTime);
});

test("the maze list shows each player's best time, fastest first", async () => {
  const worker = workerSetup();
  const { playMaze, board } = helpers(worker);
  const ala = await worker.newPlayer();
  const ola = await worker.newPlayer();
  await playMaze(ala, 90_000);
  await playMaze(ola, 85_000);
  await playMaze(ala, 80_000);

  assert.deepEqual((await board()).maze.allTime, [
    { nickname: ala.nickname, timeMs: 80_000 },
    { nickname: ola.nickname, timeMs: 85_000 },
  ]);
});

test("on equal times the earlier finish ranks higher", async () => {
  const worker = workerSetup();
  const { playMaze, board } = helpers(worker);
  const first = await worker.newPlayer();
  const second = await worker.newPlayer();
  await playMaze(first, 70_000);
  await playMaze(second, 70_000);
  const names = (await board()).maze.allTime.map((/** @type {any} */ e) => e.nickname);
  assert.deepEqual(names, [first.nickname, second.nickname]);
});

test("each list has at most 10 entries", async () => {
  const worker = workerSetup();
  const { playMaze, board } = helpers(worker);
  const players = [];
  for (let i = 0; i < 12; i++) players.push(await worker.newPlayer());
  for (const [i, player] of players.entries()) await playMaze(player, 72_000 - i * 1000);

  const list = (await board()).maze.allTime;
  assert.equal(list.length, 10);
  assert.equal(list[0].nickname, players[11].nickname);
  assert.equal(list[9].timeMs, 70_000);
});

test("the week starts on Monday 00:00 UTC", async () => {
  const worker = workerSetup(SUNDAY_LATE);
  const { playMaze, duel, board } = helpers(worker);
  const ala = await worker.newPlayer();
  const ola = await worker.newPlayer();
  await playMaze(ala, 60_000);
  await duel("m00000000001", ala, ola);

  worker.setTime(MONDAY_MORNING);
  await playMaze(ola, 65_000);
  await duel("m00000000002", ola, ala);

  const { maze, duels } = await board();
  assert.deepEqual(
    maze.allTime.map((/** @type {any} */ e) => e.nickname),
    [ala.nickname, ola.nickname],
  );
  assert.deepEqual(maze.week, [{ nickname: ola.nickname, timeMs: 65_000 }]);
  assert.equal(duels.allTime.length, 2);
  assert.deepEqual(duels.week, [{ nickname: ola.nickname, wins: 1 }]);
});
