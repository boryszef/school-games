import { log } from "../log.js";
import { deliverAnswer, listenForAnswer } from "../net/answer-relay.js";
import { ConnectionFailedError, hostPeer, joinPeer } from "../net/peer.js";
import { InvalidCodeError } from "../net/sdp-code.js";
import { h } from "./dom.js";
import { createQrCode } from "./qr.js";

/** @typedef {import("../i18n.js").Translate} Translate */
/** @typedef {import("../net/peer.js").Channel} Channel */
/** @typedef {{role: "host" | "guest", channel: Channel}} Connection */
/**
 * @typedef {object} LobbyOptions
 * @property {string} gameId
 * @property {string | null} arg The game route's argument: `join/<offer>`, `answer/<answer>` or none.
 * @property {Translate} t
 */

/**
 * Connects two players for a two-player game. Without an argument this tab invites (host);
 * with `join/<offer>` it answers an invitation (guest); with `answer/<answer>` it only hands the
 * answer over to the host's waiting tab.
 * @param {HTMLElement} root
 * @param {LobbyOptions} options
 * @returns {{connected: Promise<Connection>, close: () => void}} `connected` never settles in an
 *   answer tab or after a failure, which the lobby reports itself.
 */
export function openLobby(root, { gameId, arg, t }) {
  const [mode, code] = arg === null ? ["host", ""] : _splitArg(arg);
  const view = h("div", { class: "lobby" });
  root.replaceChildren(view);
  const show = (/** @type {(Node | string)[]} */ ...children) => view.replaceChildren(...children);
  /** @param {string} key */
  const problem = (key) =>
    show(
      h("p", { class: "notice" }, t(key)),
      h("a", { href: "#/", class: "button" }, t("lobby.home")),
    );
  const never = new Promise(() => {});

  if (mode === "host") return _host(show, problem, { gameId, t });
  if (mode === "join") {
    try {
      return _guest(show, problem, { gameId, t, offerCode: code });
    } catch (error) {
      if (!(error instanceof InvalidCodeError)) throw error;
      problem("lobby.invalidInvite");
      return { connected: never, close: () => {} };
    }
  }
  if (mode === "answer") _answerTab(show, problem, { t, answerCode: code });
  else problem("lobby.invalidInvite");
  return { connected: never, close: () => {} };
}

/** @param {string} arg */
function _splitArg(arg) {
  const slash = arg.indexOf("/");
  return slash === -1 ? [arg, ""] : [arg.slice(0, slash), arg.slice(slash + 1)];
}

/**
 * @typedef {(...children: (Node | string)[]) => void} Show
 * @typedef {(key: string) => void} Problem
 */

/**
 * @param {Show} show
 * @param {Problem} problem
 * @param {{gameId: string, t: Translate}} options
 */
function _host(show, problem, { gameId, t }) {
  const peer = hostPeer();
  let stopListening = () => {};
  /** The relay and the paste box can both bring an answer; only the first one counts. */
  let accepted = false;
  const pasted = h("input", {
    class: "lobby-paste",
    autocomplete: "off",
    "aria-label": t("lobby.pasteLabel"),
    placeholder: t("lobby.pastePlaceholder"),
  });
  const pasteError = h("p", { class: "lobby-error", "aria-live": "polite" });
  const form = h(
    "form",
    { class: "lobby-paste-form" },
    pasted,
    h("button", { type: "submit" }, t("lobby.connect")),
  );
  show(h("h2", {}, t("lobby.inviteTitle")), h("p", {}, t("lobby.preparing")));

  /** @type {Promise<Connection>} */
  const connected = new Promise((resolve) => {
    /** @param {string} input A pasted answer link or bare code. */
    const accept = async (input) => {
      if (accepted) return;
      const answerCode = input.trim().replace(/^.*\/answer\//, "");
      try {
        const connecting = peer.accept(answerCode);
        accepted = true;
        stopListening();
        show(h("p", {}, t("lobby.connecting")));
        resolve({ role: "host", channel: await connecting });
      } catch (error) {
        if (error instanceof InvalidCodeError) pasteError.textContent = t("lobby.invalidAnswer");
        else if (error instanceof ConnectionFailedError) problem("lobby.failed");
        else throw error;
      }
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      accept(pasted.value);
    });
    stopListening = listenForAnswer(peer.sessionId, accept);
  });

  peer.offerCode.then((offerCode) => {
    show(
      h("h2", {}, t("lobby.inviteTitle")),
      h("p", {}, t("lobby.inviteHelp")),
      ..._shareable(_gameLink(gameId, `join/${offerCode}`), t),
      h("p", { class: "lobby-keep-open" }, t("lobby.keepOpen")),
      h("h3", {}, t("lobby.answerTitle")),
      h("p", {}, t("lobby.answerHelp")),
      form,
      pasteError,
    );
  });

  return {
    connected,
    close() {
      stopListening();
      peer.close();
    },
  };
}

/**
 * @param {Show} show
 * @param {Problem} problem
 * @param {{gameId: string, t: Translate, offerCode: string}} options
 * @throws {InvalidCodeError}
 */
function _guest(show, problem, { gameId, t, offerCode }) {
  const peer = joinPeer(offerCode);
  show(h("h2", {}, t("lobby.joinTitle")), h("p", {}, t("lobby.preparing")));
  peer.answerCode.then((answerCode) =>
    show(
      h("h2", {}, t("lobby.joinTitle")),
      h("p", {}, t("lobby.joinHelp")),
      ..._shareable(_gameLink(gameId, `answer/${answerCode}`), t),
      h("p", { class: "lobby-waiting" }, t("lobby.waitingForHost")),
    ),
  );
  const connected = peer.channel.then(
    (channel) => /** @type {Connection} */ ({ role: "guest", channel }),
    (error) => {
      if (!(error instanceof ConnectionFailedError)) throw error;
      problem("lobby.failed");
      return new Promise(() => {});
    },
  );
  return { connected, close: peer.close };
}

/**
 * @param {Show} show
 * @param {Problem} problem
 * @param {{t: Translate, answerCode: string}} options
 */
async function _answerTab(show, problem, { t, answerCode }) {
  try {
    const delivered = await deliverAnswer(answerCode);
    log.debug("answer delivered to a waiting tab", delivered);
    if (delivered) show(h("p", { class: "notice" }, t("lobby.answerDelivered")));
    else problem("lobby.noWaitingGame");
  } catch (error) {
    if (!(error instanceof InvalidCodeError)) throw error;
    problem("lobby.invalidAnswer");
  }
}

/**
 * @param {string} gameId
 * @param {string} arg
 */
function _gameLink(gameId, arg) {
  return `${location.origin}${location.pathname}#/game/${gameId}/${arg}`;
}

/**
 * A QR code of the link, and the link itself with a copy button.
 * @param {string} link
 * @param {Translate} t
 */
function _shareable(link, t) {
  const field = h("input", { class: "lobby-link", readonly: true, value: link });
  const copy = h("button", { type: "button", class: "button secondary" }, t("lobby.copy"));
  copy.addEventListener("click", async () => {
    field.select();
    // The Clipboard API exists only on HTTPS; elsewhere the selected text can be copied by hand.
    if (navigator.clipboard === undefined) return;
    await navigator.clipboard.writeText(link);
    copy.textContent = t("lobby.copied");
  });
  return [
    h("div", { class: "lobby-qr" }, createQrCode(link)),
    h("div", { class: "lobby-link-row" }, field, copy),
  ];
}
