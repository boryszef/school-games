import { test } from "node:test";
import assert from "node:assert/strict";
import { createTimer } from "../src/core/timer.js";

/** A controllable clock: returns `now.value`. */
function fakeClock() {
  const now = { value: 1000 };
  return { now, read: () => now.value };
}

test("elapsed is 0 before start", () => {
  const clock = fakeClock();
  assert.equal(createTimer(clock.read).elapsedMs(), 0);
});

test("elapsed grows while running and freezes after stop", () => {
  const clock = fakeClock();
  const timer = createTimer(clock.read);
  timer.start();
  clock.now.value += 1500;
  assert.equal(timer.elapsedMs(), 1500);
  timer.stop();
  clock.now.value += 9999;
  assert.equal(timer.elapsedMs(), 1500);
});

test("starting an already running timer does not reset it", () => {
  const clock = fakeClock();
  const timer = createTimer(clock.read);
  timer.start();
  clock.now.value += 500;
  timer.start();
  clock.now.value += 500;
  assert.equal(timer.elapsedMs(), 1000);
});
