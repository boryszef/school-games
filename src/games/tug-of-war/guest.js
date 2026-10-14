import { parseHostMessage } from "./protocol.js";
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
  /** @param {GuestMessage} message */
  const send = (message) => channel.send(message);
  const view = createMatchView(root, {
    t: ctx.t,
    myName: ctx.player.name,
    onCorrect: ({ value, reactionMs }) => send({ type: "answer", round, value, reactionMs }),
    onPlayAgain: null,
    onHome: ctx.exit,
  });

  channel.onMessage((raw) => {
    const message = parseHostMessage(raw);
    switch (message.type) {
      case "hello":
        view.setOpponent(message.name);
        break;
      case "start":
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
  send({ type: "hello", name: ctx.player.name });

  return () => channel.close();
}
