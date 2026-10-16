import { test } from "node:test";
import assert from "node:assert/strict";
import { workerSetup } from "../helpers/worker.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** @typedef {import("../helpers/worker.js").TestPlayer} TestPlayer */

/** @param {number} i */
const matchId = (i) => `m${String(i).padStart(11, "0")}`;

async function twoPlayers() {
  const worker = workerSetup();
  const ala = await worker.newPlayer();
  const ola = await worker.newPlayer();
  /**
   * @param {TestPlayer} reporter
   * @param {string} match
   * @param {TestPlayer} opponent
   * @param {boolean} won
   */
  const report = (reporter, match, opponent, won) =>
    worker.call("POST", "/duels", {
      token: reporter.token,
      body: { matchId: match, opponentId: opponent.id, won },
    });
  /**
   * Both players say yes to the same match.
   * @param {string} match
   * @param {TestPlayer} winner
   * @param {TestPlayer} loser
   */
  const confirmed = async (match, winner, loser) => {
    assert.equal((await report(winner, match, loser, true)).status, 202);
    assert.equal((await report(loser, match, winner, false)).status, 202);
  };
  const wins = async () => {
    const board = await (await worker.call("GET", "/leaderboard")).json();
    return board.duels.allTime;
  };
  return { worker, ala, ola, report, confirmed, wins };
}

test("a win counts when both players report the same result", async () => {
  const { ala, ola, confirmed, wins } = await twoPlayers();
  await confirmed(matchId(1), ala, ola);
  assert.deepEqual(await wins(), [{ nickname: ala.nickname, wins: 1 }]);
});

test("a report from one player alone does not count", async () => {
  const { ala, ola, report, wins } = await twoPlayers();
  assert.equal((await report(ala, matchId(1), ola, true)).status, 202);
  assert.deepEqual(await wins(), []);
});

test("reports that disagree are discarded", async () => {
  const { ala, ola, report, wins } = await twoPlayers();
  await report(ala, matchId(1), ola, true);
  await report(ola, matchId(1), ala, true);
  await report(ala, matchId(2), ola, false);
  await report(ola, matchId(2), ala, false);
  assert.deepEqual(await wins(), []);
});

test("a player reports a match only once", async () => {
  const { ala, ola, report } = await twoPlayers();
  assert.equal((await report(ala, matchId(1), ola, true)).status, 202);
  assert.equal((await report(ala, matchId(1), ola, true)).status, 409);
});

test("at most 3 wins against the same opponent count per UTC day", async () => {
  const { worker, ala, ola, confirmed, wins } = await twoPlayers();
  for (let i = 1; i <= 4; i++) await confirmed(matchId(i), ala, ola);
  await confirmed(matchId(5), ola, ala);
  assert.deepEqual(await wins(), [
    { nickname: ala.nickname, wins: 3 },
    { nickname: ola.nickname, wins: 1 },
  ]);

  worker.advance(DAY_MS);
  await confirmed(matchId(6), ala, ola);
  assert.deepEqual((await wins())[0], { nickname: ala.nickname, wins: 4 });
});

test("a report must name a match and a real opponent", async () => {
  const { worker, ala, ola } = await twoPlayers();
  /** @param {unknown} body */
  const send = (body) => worker.call("POST", "/duels", { token: ala.token, body });
  const valid = { matchId: matchId(1), opponentId: ola.id, won: true };

  for (const body of [
    {},
    { ...valid, matchId: "short" },
    { ...valid, matchId: "m0000000000!" },
    { ...valid, won: "yes" },
    { ...valid, opponentId: ala.id },
    { ...valid, extra: 1 },
  ]) {
    assert.equal((await send(body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await send({ ...valid, opponentId: "B".repeat(22) })).status, 404);
});
