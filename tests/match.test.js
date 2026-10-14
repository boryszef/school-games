import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/random.js";
import {
  ROPE_TO_WIN,
  createMatch,
  nextQuestion,
  recordAnswer,
  resolveRound,
} from "../src/games/tug-of-war/match.js";

/** @typedef {import("../src/games/tug-of-war/match.js").MatchState} MatchState */
/** @typedef {import("../src/games/tug-of-war/match.js").Side} Side */

const rng = () => createRng(7);

/**
 * Plays one round that `side` wins alone.
 * @param {MatchState} state
 * @param {Side} side
 */
function winRound(state, side) {
  return resolveRound(recordAnswer(state, side, state.round, 1000), rng());
}

test("a new match starts in the middle at round 1 with a question and no answers", () => {
  const state = createMatch(rng());
  assert.equal(state.rope, 0);
  assert.equal(state.round, 1);
  assert.deepEqual(state.answers, []);
  assert.equal(state.winner, null);
  assert.ok(state.question.a >= 2 && state.question.b >= 2);
});

test("the faster reaction wins the round, whoever answered first", () => {
  let state = createMatch(rng());
  state = recordAnswer(state, "host", 1, 2400);
  state = recordAnswer(state, "guest", 1, 1900);
  state = resolveRound(state, rng());
  assert.equal(state.lastRoundWinner, "guest");
  assert.equal(state.rope, 1);
});

test("the host pulls the rope towards -1 and the guest towards +1", () => {
  const start = createMatch(rng());
  assert.equal(winRound(start, "host").rope, -1);
  assert.equal(winRound(start, "guest").rope, 1);
});

test("on equal reaction times the answer recorded first wins", () => {
  let state = createMatch(rng());
  state = recordAnswer(state, "guest", 1, 1500);
  state = recordAnswer(state, "host", 1, 1500);
  assert.equal(resolveRound(state, rng()).lastRoundWinner, "guest");
});

test("a round with a single answer goes to that player", () => {
  const state = winRound(createMatch(rng()), "host");
  assert.equal(state.lastRoundWinner, "host");
});

test("resolving a round starts the next one with a new question and no answers", () => {
  const first = createMatch(rng());
  const second = winRound(first, "guest");
  assert.equal(second.round, 2);
  assert.deepEqual(second.answers, []);
  assert.notDeepEqual(second.question, first.question);
});

test("answers to an old round are ignored", () => {
  const state = winRound(createMatch(rng()), "host");
  assert.deepEqual(recordAnswer(state, "guest", 1, 500).answers, []);
});

test("a second answer from the same player in a round is ignored", () => {
  let state = createMatch(rng());
  state = recordAnswer(state, "host", 1, 3000);
  state = recordAnswer(state, "host", 1, 800);
  assert.deepEqual(state.answers, [{ side: "host", reactionMs: 3000 }]);
});

test("pulling the rope 5 steps to one side wins the match", () => {
  let state = createMatch(rng());
  for (let i = 0; i < ROPE_TO_WIN - 1; i++) state = winRound(state, "guest");
  assert.equal(state.winner, null);
  state = winRound(state, "guest");
  assert.equal(state.rope, ROPE_TO_WIN);
  assert.equal(state.winner, "guest");
});

test("the opponent's tugs pull the rope back, so it takes 5 net steps to win", () => {
  let state = createMatch(rng());
  for (let i = 0; i < 4; i++) state = winRound(state, "host");
  state = winRound(state, "guest");
  state = winRound(state, "host");
  assert.equal(state.rope, -4);
  assert.equal(state.winner, null);
  assert.equal(winRound(state, "host").winner, "host");
});

test("no answers are recorded once the match is won", () => {
  let state = createMatch(rng());
  for (let i = 0; i < ROPE_TO_WIN; i++) state = winRound(state, "host");
  assert.deepEqual(recordAnswer(state, "guest", state.round, 100).answers, []);
});

test("questions use factors 2-10 and never repeat the previous question", () => {
  const random = createRng(3);
  let question = nextQuestion(null, random);
  for (let i = 0; i < 500; i++) {
    const next = nextQuestion(question, random);
    for (const factor of [next.a, next.b]) {
      assert.ok(Number.isInteger(factor) && factor >= 2 && factor <= 10, `factor ${factor}`);
    }
    assert.notDeepEqual(next, question);
    question = next;
  }
});

test("every factor from 2 to 10 comes up", () => {
  const random = createRng(5);
  const seen = new Set();
  let question = null;
  for (let i = 0; i < 300; i++) {
    question = nextQuestion(question, random);
    seen.add(question.a).add(question.b);
  }
  assert.deepEqual(
    [...seen].sort((x, y) => x - y),
    [2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});
