import { submitDuel } from "./leaderboard.js";
import { log } from "../../core/log.js";
import { PROTOCOL_VERSION, VersionMismatchError, parseHostMessage } from "./protocol.js";
import { createMatchView } from "./view.js";

/** @typedef {import("../../core/registry.js").GameContext} GameContext */
/** @typedef {import("../../core/net/peer.js").Channel} Channel */
/** @typedef {import("./protocol.js").GuestMessage} GuestMessage */

/**
 * Shows the host's match on the guest and sends back correct answers. The rope is mirrored so
 * that the guest, too, sees themselves on the left.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {Channel} channel
 * @returns {() => void} Cleanup.
 */
export function runGuest(root, ctx, channel) {
  let round = 0;
  /** Set by the host's `start`, which always comes before the match's `end`. */
  let matchId = "";
  /** @type {string | null} */
  let opponentId = null;
  /** @param {GuestMessage} message */
  const send = (message) => channel.send(message);
  const view = createMatchView(root, {
    t: ctx.t,
    myName: ctx.player.name,
    onCorrect: ({ value, reactionMs }) => send({ type: "answer", round, value, reactionMs }),
    onPlayAgain: null,
    onHome: ctx.exit,
    submission: (won) =>
      submitDuel(ctx.t, { account: ctx.player.account, opponentId, matchId, won }),
  });

  channel.onMessage((raw) => {
    /** @type {import("./protocol.js").HostMessage} */
    let message;
    try {
      message = parseHostMessage(raw);
    } catch (error) {
      if (!(error instanceof VersionMismatchError)) throw error;
      log.info(error.message);
      view.versionMismatch();
      channel.close();
      return;
    }
    switch (message.type) {
      case "hello":
        opponentId = message.playerId;
        view.setOpponent(message.name);
        break;
      case "start":
        matchId = message.matchId;
        view.reset();
        break;
      case "question":
        round = message.round;
        view.ask({ a: message.a, b: message.b });
        break;
      case "tug":
        view.tug(-message.rope, message.winner === "guest");
        break;
      case "end":
        view.finish(message.winner === "guest");
        break;
    }
  });
  channel.onClose(() => view.connectionLost());
  send({
    type: "hello",
    name: ctx.player.name,
    playerId: ctx.player.account?.id ?? null,
    version: PROTOCOL_VERSION,
  });

  return () => channel.close();
}
