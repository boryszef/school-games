import { log } from "../../core/log.js";
import { submitDuel, newMatchId } from "./leaderboard.js";
import { GRACE_MS, createMatch, recordAnswer, resolveRound } from "./match.js";
import { PROTOCOL_VERSION, VersionMismatchError, parseGuestMessage } from "./protocol.js";
import { createMatchView } from "./view.js";

/** @typedef {import("../../core/registry.js").GameContext} GameContext */
/** @typedef {import("../../core/net/peer.js").Channel} Channel */
/** @typedef {import("./match.js").MatchState} MatchState */
/** @typedef {import("./match.js").Side} Side */
/** @typedef {import("./protocol.js").HostMessage} HostMessage */

/** Time to read "Get ready!" before the first question. */
const START_DELAY_MS = 1500;
/** Time to watch the tug before the next question. */
const TUG_PAUSE_MS = 1200;

/**
 * Runs the match on the host, which decides every round and tells the guest.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {Channel} channel
 * @returns {() => void} Cleanup.
 */
export function runHost(root, ctx, channel) {
  /** @type {MatchState} */
  let state = createMatch(Math.random);
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** A new one for every match, set by `start`. */
  let matchId = "";
  /** @type {string | null} */
  let opponentId = null;
  const view = createMatchView(root, {
    t: ctx.t,
    myName: ctx.player.name,
    onCorrect: ({ reactionMs }) => record("host", state.round, reactionMs),
    onPlayAgain: start,
    onHome: ctx.exit,
    submission: (won) =>
      submitDuel(ctx.t, { account: ctx.player.account, opponentId, matchId, won }),
  });
  /** @param {HostMessage} message */
  const send = (message) => channel.send(message);

  channel.onMessage((raw) => {
    /** @type {import("./protocol.js").GuestMessage} */
    let message;
    try {
      message = parseGuestMessage(raw);
    } catch (error) {
      if (!(error instanceof VersionMismatchError)) throw error;
      log.info(error.message);
      clearTimeout(timer);
      view.versionMismatch();
      channel.close();
      return;
    }
    if (message.type === "hello") {
      opponentId = message.playerId;
      view.setOpponent(message.name);
    } else if (message.value === state.question.a * state.question.b) {
      record("guest", message.round, message.reactionMs);
    } else log.debug("ignored a wrong answer from the guest", message);
  });
  channel.onClose(() => {
    clearTimeout(timer);
    view.connectionLost();
  });
  send({
    type: "hello",
    name: ctx.player.name,
    playerId: ctx.player.account?.id ?? null,
    version: PROTOCOL_VERSION,
  });
  start();

  function start() {
    clearTimeout(timer);
    state = createMatch(Math.random);
    matchId = newMatchId();
    send({ type: "start", matchId });
    view.reset();
    timer = setTimeout(ask, START_DELAY_MS);
  }

  function ask() {
    const { round, question } = state;
    send({ type: "question", round, a: question.a, b: question.b });
    view.ask(question);
  }

  /**
   * @param {Side} side
   * @param {number} round
   * @param {number} reactionMs
   */
  function record(side, round, reactionMs) {
    const before = state.answers.length;
    state = recordAnswer(state, side, round, reactionMs);
    log.debug("answer", { side, round, reactionMs, recorded: state.answers.length > before });
    if (state.answers.length === before) return;
    if (state.answers.length === 2) resolve();
    else timer = setTimeout(resolve, GRACE_MS);
  }

  function resolve() {
    clearTimeout(timer);
    const round = state.round;
    state = resolveRound(state, Math.random);
    const winner = /** @type {Side} */ (state.lastRoundWinner);
    send({ type: "tug", round, winner, rope: state.rope });
    view.tug(state.rope, winner === "host");
    if (state.winner === null) {
      timer = setTimeout(ask, TUG_PAUSE_MS);
      return;
    }
    log.info(`tug-of-war won by the ${state.winner}`);
    send({ type: "end", winner: state.winner });
    view.finish(state.winner === "host");
  }

  return () => {
    clearTimeout(timer);
    channel.close();
  };
}
