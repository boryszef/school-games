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

test("#/game/<id> is a game route with its id and no argument", () => {
  assert.deepEqual(parseRoute("#/game/robot-maze"), { name: "game", id: "robot-maze", arg: null });
});

test("the rest of the hash after #/game/<id>/ is the game's argument", () => {
  assert.deepEqual(parseRoute("#/game/tug-of-war/join/aB3_-x"), {
    name: "game",
    id: "tug-of-war",
    arg: "join/aB3_-x",
  });
});

test("anything else is not found", () => {
  assert.deepEqual(parseRoute("#/nope"), { name: "notFound" });
  assert.deepEqual(parseRoute("#/game/"), { name: "notFound" });
  assert.deepEqual(parseRoute("#/game/robot-maze/"), { name: "notFound" });
});
