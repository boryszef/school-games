import { test } from "node:test";
import assert from "node:assert/strict";
import { playPirates } from "../helpers/pirate-player.js";
import { workerSetup } from "../helpers/worker.js";

/** @typedef {import("../helpers/pirate-player.js").PiratePlan} PiratePlan */

/** @param {ReturnType<typeof workerSetup>} worker */
async function startRun(worker) {
  const player = await worker.newPlayer();
  const response = await worker.call("POST", "/pirate-runs", { token: player.token, body: {} });
  assert.equal(response.status, 201);
  /** @type {{runId: string, seed: number}} */
  const run = await response.json();
  /** @param {unknown} actions */
  const finish = (actions, token = player.token) =>
    worker.call("POST", `/pirate-runs/${run.runId}/finish`, { token, body: { actions } });
  /**
   * Plays the game honestly, letting the server's clock run as long as the answers took.
   * @param {PiratePlan} plan
   */
  const play = (plan) => {
    const game = playPirates(run.seed, plan);
    worker.advance(game.answerMs);
    return game;
  };
  return { player, run, finish, play };
}

test("a new pirate run has an id and a whole-number seed", async () => {
  const { run } = await startRun(workerSetup());
  assert.match(run.runId, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(Number.isInteger(run.seed) && run.seed >= 0 && run.seed < 2 ** 32, `${run.seed}`);
});

test("starting a run takes an empty body", async () => {
  const worker = workerSetup();
  const player = await worker.newPlayer();
  const response = await worker.call("POST", "/pirate-runs", {
    token: player.token,
    body: { level: "hard" },
  });
  assert.equal(response.status, 400);
});

test("starting a run needs a player", async () => {
  const response = await workerSetup().call("POST", "/pirate-runs", { body: {} });
  assert.equal(response.status, 401);
});

test("a captain who retires scores the loot from the replay", async () => {
  const worker = workerSetup();
  const { finish, play } = await startRun(worker);
  const { actions, state } = play({ trips: 3, end: "retire" });
  assert.ok(state.loot >= 3);
  const response = await finish(actions);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { score: state.loot });
});

for (const end of /** @type {const} */ (["wrong", "silent", "late"])) {
  test(`a captain thrown overboard (${end}) scores 0`, async () => {
    const worker = workerSetup();
    const { finish, play } = await startRun(worker);
    const response = await finish(play({ trips: 3, end }).actions);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { score: 0 });
  });
}

test("a captain thrown overboard on the first trip scores 0", async () => {
  const worker = workerSetup();
  const { finish, play } = await startRun(worker);
  const response = await finish(play({ trips: 0, end: "wrong" }).actions);
  assert.deepEqual(await response.json(), { score: 0 });
});

test("actions that don't follow the game are refused", async () => {
  const worker = workerSetup();
  const { finish, play } = await startRun(worker);
  const won = play({ trips: 2, end: "retire" }).actions;
  const lost = play({ trips: 1, end: "wrong" }).actions;
  const [first] = won;
  for (const actions of [
    ["retire"],
    ["sail", first],
    [first, first],
    [first, "sail", "sail"],
    [...won, "sail"],
    [...won, "retire"],
    [...lost, "retire"],
    [...lost, "sail"],
  ]) {
    assert.equal((await finish(actions)).status, 400, JSON.stringify(actions));
  }
});

test("a game that hasn't ended is refused", async () => {
  const worker = workerSetup();
  const { finish, play } = await startRun(worker);
  const { actions } = play({ trips: 2, end: "none" });
  for (const unfinished of [[], actions, [...actions, "sail"]]) {
    assert.equal((await finish(unfinished)).status, 400, JSON.stringify(unfinished));
  }
});

test("malformed actions are refused", async () => {
  const worker = workerSetup();
  const { finish } = await startRun(worker);
  for (const actions of [
    undefined,
    "retire",
    ["stay"],
    [null],
    [{ answer: 0, ms: 1000 }],
    [{ answer: 11, ms: 1000 }],
    [{ answer: 1.5, ms: 1000 }],
    [{ answer: "7", ms: 1000 }],
    [{ answer: 7 }],
    [{ answer: 7, ms: -1 }],
    [{ answer: 7, ms: 1.5 }],
    [{ answer: 7, ms: 1000, x: 1 }],
  ]) {
    assert.equal((await finish(actions)).status, 400, JSON.stringify(actions));
  }
});

test("at most 1000 actions are accepted", async () => {
  const worker = workerSetup();
  const { finish, play } = await startRun(worker);
  // 500 won trips: an answer and a "sail" or "retire" each.
  const retired = play({ trips: 500, end: "retire", ms: 0 }).actions;
  // 500 won trips, then a "sail" and a wrong answer: a whole game, one action too long.
  const overboard = play({ trips: 500, end: "wrong", ms: 0 }).actions;
  assert.equal(retired.length, 1000);
  assert.equal(overboard.length, 1001);
  assert.equal((await finish(overboard)).status, 400);
  assert.equal((await finish(retired)).status, 200);
});

test("answers can't take longer in total than the server measured", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  const { actions, answerMs } = playPirates(run.seed, { trips: 3, end: "retire" });
  worker.advance(answerMs - 1);
  assert.equal((await finish(actions)).status, 422);
  worker.advance(1);
  assert.equal((await finish(actions)).status, 200);
});

test("a finish more than 1 hour after the start is too late", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  worker.advance(60 * 60 * 1000 + 1);
  assert.equal(
    (await finish(playPirates(run.seed, { trips: 1, end: "retire" }).actions)).status,
    422,
  );
});

test("a pirate run can be finished only once", async () => {
  const worker = workerSetup();
  const { finish, play } = await startRun(worker);
  const { actions } = play({ trips: 2, end: "retire" });
  assert.equal((await finish(actions)).status, 200);
  assert.equal((await finish(actions)).status, 409);
});

test("only the player who started the pirate run can finish it", async () => {
  const worker = workerSetup();
  const { finish, play } = await startRun(worker);
  const other = await worker.newPlayer();
  assert.equal((await finish(play({ trips: 1, end: "retire" }).actions, other.token)).status, 404);
});

test("an unknown pirate run is not found", async () => {
  const worker = workerSetup();
  const player = await worker.newPlayer();
  const response = await worker.call("POST", "/pirate-runs/nope/finish", {
    token: player.token,
    body: { actions: ["retire"] },
  });
  assert.equal(response.status, 404);
});
