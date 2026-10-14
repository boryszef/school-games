import { log } from "../log.js";
import { deliverAnswer, listenForAnswer } from "../net/answer-relay.js";
import { CONNECT_TIMEOUT_MS, ConnectionFailedError, hostPeer, joinPeer } from "../net/peer.js";
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
 * Invites; after a timeout the player can retry with a fresh invitation.
 * @param {Show} show
 * @param {Problem} problem
 * @param {{gameId: string, t: Translate}} options
 */
function _host(show, problem, { gameId, t }) {
  let closeAttempt = () => {};
  /** @type {Promise<Connection>} */
  const connected = new Promise((resolve) => {
    const attempt = () => {
      closeAttempt = _hostAttempt(show, problem, {
        gameId,
        t,
        onConnected: resolve,
        onTimeout: timedOut,
      });
    };
    const timedOut = () => {
      const retry = h("button", { type: "button", class: "button" }, t("lobby.tryAgain"));
      retry.addEventListener("click", () => {
        closeAttempt();
        attempt();
      });
      show(
        h("p", { class: "notice" }, t("lobby.timedOut", { seconds: CONNECT_TIMEOUT_MS / 1000 })),
        h(
          "div",
          { class: "lobby-actions" },
          retry,
          h("a", { href: "#/", class: "button secondary" }, t("lobby.home")),
        ),
      );
    };
    attempt();
  });
  return { connected, close: () => closeAttempt() };
}

/**
 * @typedef {object} HostAttemptOptions
 * @property {string} gameId
 * @property {Translate} t
 * @property {(connection: Connection) => void} onConnected
 * @property {() => void} onTimeout
 */

/**
 * One invitation: shows it, takes the answer from the relay or the paste box, and counts down
 * while connecting.
 * @param {Show} show
 * @param {Problem} problem
 * @param {HostAttemptOptions} options
 * @returns {() => void} Closes the attempt.
 */
function _hostAttempt(show, problem, { gameId, t, onConnected, onTimeout }) {
  const peer = hostPeer();
  /** The relay and the paste box can both bring an answer; only the first one counts. */
  let accepted = false;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let countdown;
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

  /** @param {string} input A pasted answer link or bare code. */
  const accept = async (input) => {
    if (accepted) return;
    const answerCode = input.trim().replace(/^.*\/answer\//, "");
    try {
      const connecting = peer.accept(answerCode);
      accepted = true;
      stopListening();
      showCountdown();
      onConnected({ role: "host", channel: await connecting });
    } catch (error) {
      if (error instanceof InvalidCodeError) pasteError.textContent = t("lobby.invalidAnswer");
      else if (!(error instanceof ConnectionFailedError)) throw error;
      else if (error.reason === "timeout") onTimeout();
      else problem("lobby.failed");
    } finally {
      clearInterval(countdown);
    }
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    accept(pasted.value);
  });
  const stopListening = listenForAnswer(peer.sessionId, accept);

  function showCountdown() {
    let seconds = CONNECT_TIMEOUT_MS / 1000;
    const status = h("p", { "aria-live": "polite" });
    const render = () => (status.textContent = t("lobby.connecting", { seconds }));
    render();
    show(status);
    countdown = setInterval(() => {
      seconds = Math.max(0, seconds - 1);
      render();
    }, 1000);
  }

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

  return () => {
    clearInterval(countdown);
    stopListening();
    peer.close();
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
