import { test } from "node:test";
import assert from "node:assert/strict";
import { playColors } from "../helpers/color-player.js";
import { workerSetup } from "../helpers/worker.js";

/**
 * @param {ReturnType<typeof workerSetup>} worker
 * @param {string} [lang]
 */
async function startRun(worker, lang = "de") {
  const player = await worker.newPlayer();
  const response = await worker.call("POST", "/color-runs", {
    token: player.token,
    body: { lang },
  });
  assert.equal(response.status, 201);
  /** @type {{runId: string, seed: number}} */
  const run = await response.json();
  /** @param {unknown} actions */
  const finish = (actions, token = player.token) =>
    worker.call("POST", `/color-runs/${run.runId}/finish`, { token, body: { actions } });
  return { player, run, finish };
}

test("a new color run has an id and a whole-number seed", async () => {
  const { run } = await startRun(workerSetup());
  assert.match(run.runId, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(Number.isInteger(run.seed) && run.seed >= 0 && run.seed < 2 ** 32, `${run.seed}`);
});

test("the score comes from replaying the moves and shots", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  worker.advance(60_000);
  const response = await finish(playColors(run.seed, { hits: 3, misses: 2 }).actions);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { score: 1 });
});

test("the replay counts the bonus for a cleared column", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  // 50 hits over 10 columns: at least one column takes 5 of them.
  const { actions, state } = playColors(run.seed, { hits: 50 });
  assert.ok(state.clears > 0);
  const response = await finish(actions);
  assert.deepEqual(await response.json(), { score: state.score });
});

test("moves with the arrow commands are replayed too", async () => {
  const worker = workerSetup();
  const { finish } = await startRun(worker);
  const response = await finish(["left", "left", "right", "shoot"]);
  assert.equal(response.status, 200);
  const { score } = await response.json();
  assert.ok(score === 1 || score === -1, `${score}`);
});

test("starting a run needs one of the target languages", async () => {
  const worker = workerSetup();
  const player = await worker.newPlayer();
  for (const body of [{}, { lang: "pl" }, { lang: 1 }, { lang: "en", x: 1 }]) {
    const response = await worker.call("POST", "/color-runs", { token: player.token, body });
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("starting a run needs a player", async () => {
  const response = await workerSetup().call("POST", "/color-runs", { body: { lang: "en" } });
  assert.equal(response.status, 401);
});

test("malformed actions are refused", async () => {
  const worker = workerSetup();
  const { finish } = await startRun(worker);
  for (const actions of [
    undefined,
    "shoot",
    ["up"],
    [{ to: 10 }],
    [{ to: -1 }],
    [{ to: 1.5 }],
    [{ to: 1, x: 1 }],
    [null],
  ]) {
    assert.equal((await finish(actions)).status, 400, JSON.stringify(actions));
  }
});

test("at most 1000 actions are accepted", async () => {
  const worker = workerSetup();
  const { finish } = await startRun(worker);
  assert.equal((await finish(Array(1001).fill("left"))).status, 400);
  assert.equal((await finish(Array(1000).fill("left"))).status, 200);
});

test("a finish more than 70 s after the start is too late", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  worker.advance(70_001);
  assert.equal((await finish(playColors(run.seed, { hits: 1 }).actions)).status, 422);
});

test("a finish 70 s after the start still counts", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  worker.advance(70_000);
  assert.equal((await finish(playColors(run.seed, { hits: 1 }).actions)).status, 200);
});

test("a color run can be finished only once", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  const { actions } = playColors(run.seed, { hits: 2 });
  assert.equal((await finish(actions)).status, 200);
  assert.equal((await finish(actions)).status, 409);
});

test("only the player who started the color run can finish it", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  const other = await worker.newPlayer();
  assert.equal((await finish(playColors(run.seed, { hits: 1 }).actions, other.token)).status, 404);
});

test("an unknown color run is not found", async () => {
  const worker = workerSetup();
  const player = await worker.newPlayer();
  const response = await worker.call("POST", "/color-runs/nope/finish", {
    token: player.token,
    body: { actions: [] },
  });
  assert.equal(response.status, 404);
});
