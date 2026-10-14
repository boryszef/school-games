import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute } from "../src/core/router.js";

test("an empty hash and #/ are the home route", () => {
  assert.deepEqual(parseRoute(""), { name: "home" });
  assert.deepEqual(parseRoute("#/"), { name: "home" });
});

test("#/players is the players route", () => {
  assert.deepEqual(parseRoute("#/players"), { name: "players" });
});

test("#/game/<id> is a game route with its id", () => {
  assert.deepEqual(parseRoute("#/game/robot-maze"), { name: "game", id: "robot-maze" });
});

test("anything else is not found", () => {
  assert.deepEqual(parseRoute("#/nope"), { name: "notFound" });
  assert.deepEqual(parseRoute("#/game/"), { name: "notFound" });
});
