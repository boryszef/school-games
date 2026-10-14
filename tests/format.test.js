import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime } from "../src/core/format.js";

test("formats milliseconds as m:ss.t", () => {
  assert.equal(formatTime(65432), "1:05.4");
});

test("formats zero", () => {
  assert.equal(formatTime(0), "0:00.0");
});

test("truncates instead of rounding up to the next second", () => {
  assert.equal(formatTime(59999), "0:59.9");
});
