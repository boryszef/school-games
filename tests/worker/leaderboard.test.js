import { test } from "node:test";
import assert from "node:assert/strict";
import { playColors } from "../helpers/color-player.js";
import { solveActions } from "../helpers/maze-solver.js";
import { playPirates } from "../helpers/pirate-player.js";
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
  /**
   * Plays a Color Invasion round. Fewer than 5 hits can't clear a column, so the score is
   * `hits - misses`.
   * @param {TestPlayer} player
   * @param {string} lang
   * @param {{hits: number, misses?: number}} plan
   */
  const playColorRound = async (player, lang, plan) => {
    const started = await worker.call("POST", "/color-runs", {
      token: player.token,
      body: { lang },
    });
    const { runId, seed } = await started.json();
    worker.advance(60_000);
    const finished = await worker.call("POST", `/color-runs/${runId}/finish`, {
      token: player.token,
      body: { actions: playColors(seed, plan).actions },
    });
    assert.equal(finished.status, 200);
  };
  /**
   * Plays a Pirate Loot game.
   * @param {TestPlayer} player
   * @param {import("../helpers/pirate-player.js").PiratePlan} plan
   * @returns {Promise<number>} The score.
   */
  const playPirateGame = async (player, plan) => {
    const started = await worker.call("POST", "/pirate-runs", { token: player.token, body: {} });
    const { runId, seed } = await started.json();
    const { actions, answerMs } = playPirates(seed, plan);
    worker.advance(answerMs);
    const finished = await worker.call("POST", `/pirate-runs/${runId}/finish`, {
      token: player.token,
      body: { actions },
    });
    assert.equal(finished.status, 200);
    return (await finished.json()).score;
  };
  const board = async () => (await worker.call("GET", "/leaderboard")).json();
  return { playMaze, duel, playColorRound, playPirateGame, board };
}

test("an empty leaderboard has empty lists and is never cached", async () => {
  const worker = workerSetup();
  const response = await worker.call("GET", "/leaderboard");
  assert.equal(response.status, 200);
  // A cached copy hid a new record right after it was added.
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    maze: { allTime: [], week: [] },
    mazeHard: { allTime: [], week: [] },
    duels: { allTime: [], week: [] },
    colors: {
      en: { allTime: [], week: [] },
      de: { allTime: [], week: [] },
      es: { allTime: [], week: [] },
    },
    pirates: { allTime: [], week: [] },
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

test("color scores are ranked per language", async () => {
  const worker = workerSetup();
  const { playColorRound, board } = helpers(worker);
  const [ala, ola] = [await worker.newPlayer(), await worker.newPlayer()];
  await playColorRound(ala, "en", { hits: 3 });
  await playColorRound(ola, "es", { hits: 2 });

  const { colors } = await board();
  assert.deepEqual(colors.en.allTime, [{ nickname: ala.nickname, score: 3 }]);
  assert.deepEqual(colors.de.allTime, []);
  assert.deepEqual(colors.es.allTime, [{ nickname: ola.nickname, score: 2 }]);
  assert.deepEqual(colors.es.week, colors.es.allTime);
});

test("the color list shows each player's best score, highest first", async () => {
  const worker = workerSetup();
  const { playColorRound, board } = helpers(worker);
  const [ala, ola] = [await worker.newPlayer(), await worker.newPlayer()];
  await playColorRound(ala, "de", { hits: 2 });
  await playColorRound(ola, "de", { hits: 3 });
  await playColorRound(ala, "de", { hits: 4 });
  await playColorRound(ola, "de", { hits: 1, misses: 3 });

  assert.deepEqual((await board()).colors.de.allTime, [
    { nickname: ala.nickname, score: 4 },
    { nickname: ola.nickname, score: 3 },
  ]);
});

test("on equal scores the earlier round ranks higher", async () => {
  const worker = workerSetup();
  const { playColorRound, board } = helpers(worker);
  const [first, second] = [await worker.newPlayer(), await worker.newPlayer()];
  await playColorRound(first, "en", { hits: 2 });
  await playColorRound(second, "en", { hits: 2 });
  const names = (await board()).colors.en.allTime.map((/** @type {any} */ e) => e.nickname);
  assert.deepEqual(names, [first.nickname, second.nickname]);
});

test("the weekly color list starts on Monday 00:00 UTC", async () => {
  const worker = workerSetup(SUNDAY_LATE - 120_000);
  const { playColorRound, board } = helpers(worker);
  const [ala, ola] = [await worker.newPlayer(), await worker.newPlayer()];
  await playColorRound(ala, "es", { hits: 4 });

  worker.setTime(MONDAY_MORNING);
  await playColorRound(ola, "es", { hits: 1 });

  const { es } = (await board()).colors;
  assert.equal(es.allTime.length, 2);
  assert.deepEqual(es.week, [{ nickname: ola.nickname, score: 1 }]);
});

test("the pirate list shows each player's best loot, highest first", async () => {
  const worker = workerSetup();
  const { playPirateGame, board } = helpers(worker);
  const [ala, ola] = [await worker.newPlayer(), await worker.newPlayer()];
  // One trip brings at most 10 coins, eleven trips at least 11.
  const alaBest = await playPirateGame(ala, { trips: 1, end: "retire" });
  const olaBest = await playPirateGame(ola, { trips: 11, end: "retire" });
  await playPirateGame(ola, { trips: 1, end: "retire" });
  await playPirateGame(ala, { trips: 4, end: "wrong" });

  assert.deepEqual((await board()).pirates.allTime, [
    { nickname: ola.nickname, score: olaBest },
    { nickname: ala.nickname, score: alaBest },
  ]);
});

test("captains who only went overboard are not on the pirate list", async () => {
  const worker = workerSetup();
  const { playPirateGame, board } = helpers(worker);
  const [ala, ola] = [await worker.newPlayer(), await worker.newPlayer()];
  const alaBest = await playPirateGame(ala, { trips: 2, end: "retire" });
  await playPirateGame(ola, { trips: 3, end: "silent" });

  const { pirates } = await board();
  assert.deepEqual(pirates.allTime, [{ nickname: ala.nickname, score: alaBest }]);
  assert.deepEqual(pirates.week, pirates.allTime);
});

test("the weekly pirate list starts on Monday 00:00 UTC", async () => {
  const worker = workerSetup(SUNDAY_LATE);
  const { playPirateGame, board } = helpers(worker);
  const [ala, ola] = [await worker.newPlayer(), await worker.newPlayer()];
  await playPirateGame(ala, { trips: 2, end: "retire" });

  worker.setTime(MONDAY_MORNING);
  const olaBest = await playPirateGame(ola, { trips: 1, end: "retire" });

  const { pirates } = await board();
  assert.equal(pirates.allTime.length, 2);
  assert.deepEqual(pirates.week, [{ nickname: ola.nickname, score: olaBest }]);
});
