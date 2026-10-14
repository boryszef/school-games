/**
 * Tug of War rules, run by the host. Both players get the same question; the faster correct
 * answer (by each player's own reaction time) tugs the rope one step towards its side.
 */

/** @typedef {import("../../core/random.js").Rng} Rng */
/** @typedef {"host" | "guest"} Side */
/** @typedef {{a: number, b: number}} Question */
/** @typedef {{side: Side, reactionMs: number}} Answer */
/**
 * @typedef {object} MatchState
 * @property {number} rope Negative towards the host, positive towards the guest.
 * @property {number} round
 * @property {Question} question
 * @property {Answer[]} answers Correct answers to the current round, in the order received.
 * @property {Side | null} lastRoundWinner
 * @property {Side | null} winner
 */

export const ROPE_TO_WIN = 5;
/** How long the host waits after the first correct answer for a faster one still on its way. */
export const GRACE_MS = 300;
const MIN_FACTOR = 2;
const MAX_FACTOR = 10;
/** @type {Record<Side, number>} */
const PULL = { host: -1, guest: 1 };

/**
 * @param {Rng} rng
 * @returns {MatchState}
 */
export function createMatch(rng) {
  return {
    rope: 0,
    round: 1,
    question: nextQuestion(null, rng),
    answers: [],
    lastRoundWinner: null,
    winner: null,
  };
}

/**
 * Records a correct answer; late answers, repeated ones and answers after the match ends are
 * ignored.
 * @param {MatchState} state
 * @param {Side} side
 * @param {number} round
 * @param {number} reactionMs
 * @returns {MatchState}
 */
export function recordAnswer(state, side, round, reactionMs) {
  const ignored =
    state.winner !== null || round !== state.round || state.answers.some((a) => a.side === side);
  if (ignored) return state;
  return { ...state, answers: [...state.answers, { side, reactionMs }] };
}

/**
 * Gives the round to the fastest recorded answer (the first recorded on a tie) and moves on to the
 * next question, unless the rope has reached a side.
 * @param {MatchState} state Must have at least one answer.
 * @param {Rng} rng
 * @returns {MatchState}
 */
export function resolveRound(state, rng) {
  const fastest = state.answers.reduce((best, a) => (a.reactionMs < best.reactionMs ? a : best));
  const rope = state.rope + PULL[fastest.side];
  const won = Math.abs(rope) >= ROPE_TO_WIN;
  return {
    rope,
    round: won ? state.round : state.round + 1,
    question: won ? state.question : nextQuestion(state.question, rng),
    answers: [],
    lastRoundWinner: fastest.side,
    winner: won ? fastest.side : null,
  };
}

/**
 * A random a × b with both factors in 2–10, different from the previous question.
 * @param {Question | null} previous
 * @param {Rng} rng
 * @returns {Question}
 */
export function nextQuestion(previous, rng) {
  const factor = () => MIN_FACTOR + Math.floor(rng() * (MAX_FACTOR - MIN_FACTOR + 1));
  for (;;) {
    const question = { a: factor(), b: factor() };
    if (previous === null || question.a !== previous.a || question.b !== previous.b) {
      return question;
    }
  }
}
