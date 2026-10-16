import { test } from "node:test";
import assert from "node:assert/strict";
import { solveActions } from "../helpers/maze-solver.js";
import { workerSetup } from "../helpers/worker.js";

const HOUR_MS = 60 * 60 * 1000;

/** @param {ReturnType<typeof workerSetup>} worker */
async function startRun(worker) {
  const player = await worker.newPlayer();
  const response = await worker.call("POST", "/maze-runs", { token: player.token });
  assert.equal(response.status, 201);
  /** @type {{runId: string, seed: number}} */
  const run = await response.json();
  /** @param {unknown} actions */
  const finish = (actions, token = player.token) =>
    worker.call("POST", `/maze-runs/${run.runId}/finish`, { token, body: { actions } });
  return { player, run, finish };
}

test("a new run has an id and a whole-number seed", async () => {
  const { run } = await startRun(workerSetup());
  assert.match(run.runId, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(Number.isInteger(run.seed) && run.seed >= 0 && run.seed < 2 ** 32, `${run.seed}`);
});

test("an honest run counts the server's time plus 5 s per wrong answer", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  worker.advance(40_000);

  const response = await finish(solveActions(run.seed, { wrongAnswers: 2 }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { timeMs: 50_000, penaltyMs: 10_000 });
});

test("a replay that does not reach the exit is refused", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  const actions = solveActions(run.seed);
  assert.equal((await finish(actions.slice(0, -1))).status, 422);
  assert.equal((await finish([])).status, 422);
});

test("a run can be finished only once", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  assert.equal((await finish(solveActions(run.seed))).status, 200);
  assert.equal((await finish(solveActions(run.seed))).status, 409);
});

test("only the player who started the run can finish it", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  const other = await worker.newPlayer();
  assert.equal((await finish(solveActions(run.seed), other.token)).status, 404);
});

test("unknown runs and runs older than an hour are not found", async () => {
  const worker = workerSetup();
  const { player, run, finish } = await startRun(worker);
  const unknown = await worker.call("POST", `/maze-runs/${"A".repeat(22)}/finish`, {
    token: player.token,
    body: { actions: solveActions(run.seed) },
  });
  assert.equal(unknown.status, 404);

  worker.advance(HOUR_MS);
  assert.equal((await finish(solveActions(run.seed))).status, 404);
});

test("at most 2000 actions are accepted", async () => {
  const worker = workerSetup();
  const { run, finish } = await startRun(worker);
  const honest = solveActions(run.seed);
  const padded = [...Array(2000 - honest.length).fill("up"), ...honest];
  assert.equal((await finish([...padded, "up"])).status, 400);
  assert.equal((await finish(padded)).status, 200);
});

test("actions must be directions or whole-number answers", async () => {
  const worker = workerSetup();
  const { finish } = await startRun(worker);
  const invalid = [
    undefined,
    "up",
    {},
    ["north"],
    [null],
    [{ answer: "56" }],
    [{ answer: 5.5 }],
    [{ answer: -1 }],
    [{ answer: 5, extra: 1 }],
    [{}],
  ];
  for (const actions of invalid) {
    assert.equal((await finish(actions)).status, 400, JSON.stringify(actions));
  }
});
