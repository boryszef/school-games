import { ApiError, ServerUnreachableError } from "../online/api.js";
import {
  CONNECT_TIMEOUT_MS,
  ConnectionFailedError,
  RoomExpiredError,
  RoomGoneError,
  hostPeer,
  joinPeer,
} from "../net/peer.js";
import { InvalidRoomCodeError, parseRoomCode } from "../net/room-code.js";
import { h } from "./dom.js";
import { createQrCode } from "./qr.js";

/** @typedef {import("../i18n.js").Translate} Translate */
/** @typedef {import("../net/peer.js").Channel} Channel */
/** @typedef {{role: "host" | "guest", channel: Channel}} Connection */
/**
 * @typedef {object} LobbyOptions
 * @property {string} gameId
 * @property {string | null} arg The game route's argument: `join/<code>` or none.
 * @property {Translate} t
 */
/**
 * @typedef {object} View
 * @property {(...children: (Node | string)[]) => void} show
 * @property {Translate} t
 * @property {(key: string) => void} problem A message with "Back to games" only.
 * @property {(key: string, buttonKey: string, again: () => void) => void} retry A message with a
 *   button that runs `again`, and "Back to games".
 */
/**
 * One connection try; `again` starts a new one. Returns a function that cancels the try.
 * @typedef {(onConnected: (connection: Connection) => void, again: () => void) => () => void}
 *   Attempt
 */

/**
 * Connects two players for a two-player game. Without an argument this tab opens a room (host);
 * with `join/<code>` it joins that room (guest).
 * @param {HTMLElement} root
 * @param {LobbyOptions} options
 * @returns {{connected: Promise<Connection>, close: () => void}} `connected` never settles after
 *   a failure, which the lobby reports itself.
 */
export function openLobby(root, { gameId, arg, t }) {
  const element = h("div", { class: "lobby" });
  root.replaceChildren(element);
  const view = _view(element, t);

  if (arg === null)
    return _attempts((onConnected, again) => _host(view, gameId, onConnected, again));
  try {
    if (!arg.startsWith("join/")) throw new InvalidRoomCodeError(arg);
    const code = parseRoomCode(arg.slice("join/".length));
    return _attempts((onConnected, again) => _guest(view, code, onConnected, again));
  } catch (error) {
    if (!(error instanceof InvalidRoomCodeError)) throw error;
    view.problem("lobby.invalidInvite");
    return { connected: new Promise(() => {}), close: () => {} };
  }
}

/**
 * @param {HTMLElement} element
 * @param {Translate} t
 * @returns {View}
 */
function _view(element, t) {
  const show = (/** @type {(Node | string)[]} */ ...children) =>
    element.replaceChildren(...children);
  const home = () => h("a", { href: "#/", class: "button secondary" }, t("lobby.home"));
  /**
   * @param {string} key
   * @param {HTMLElement[]} buttons
   */
  const message = (key, buttons) =>
    show(
      h("p", { class: "notice" }, t(key, { seconds: CONNECT_TIMEOUT_MS / 1000 })),
      h("div", { class: "lobby-actions" }, ...buttons, home()),
    );
  return {
    show,
    t,
    problem: (key) => message(key, []),
    retry(key, buttonKey, again) {
      const button = h("button", { type: "button", class: "button" }, t(buttonKey));
      button.addEventListener("click", again);
      message(key, [button]);
    },
  };
}

/**
 * Runs tries until one connects; a retry button cancels the current try and starts a new one.
 * @param {Attempt} attempt
 */
function _attempts(attempt) {
  let cancel = () => {};
  /** @type {Promise<Connection>} */
  const connected = new Promise((resolve) => {
    const again = () => {
      cancel();
      cancel = attempt(resolve, again);
    };
    again();
  });
  return { connected, close: () => cancel() };
}

/**
 * Opens a room, shows its code, link and QR code, and counts down while connecting.
 * @param {View} view
 * @param {string} gameId
 * @param {(connection: Connection) => void} onConnected
 * @param {() => void} again
 */
function _host(view, gameId, onConnected, again) {
  const { show, t } = view;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let countdown;
  let cancelled = false;
  show(h("h2", {}, t("lobby.inviteTitle")), h("p", {}, t("lobby.preparing")));

  const peer = hostPeer({
    onCode: (code) =>
      show(
        h("h2", {}, t("lobby.inviteTitle")),
        h("p", {}, t("lobby.inviteHelp")),
        h("p", { class: "lobby-code", "aria-label": t("lobby.codeLabel") }, code),
        ..._shareable(_gameLink(gameId, `join/${code}`), t),
        ..._codeForm(gameId, t),
      ),
    onAnswer: () => {
      let seconds = CONNECT_TIMEOUT_MS / 1000;
      const status = h("p", { "aria-live": "polite" });
      const render = () => (status.textContent = t("lobby.connecting", { seconds }));
      render();
      show(status);
      countdown = setInterval(() => {
        seconds = Math.max(0, seconds - 1);
        render();
      }, 1000);
    },
  });
  peer.channel.then(
    (channel) => {
      clearInterval(countdown);
      onConnected({ role: "host", channel });
    },
    (error) => {
      clearInterval(countdown);
      if (cancelled) return;
      if (error instanceof RoomExpiredError)
        view.retry("lobby.expired", "lobby.newInvitation", again);
      else if (error instanceof ConnectionFailedError && error.reason === "timeout") {
        view.retry("lobby.timedOut", "lobby.tryAgain", again);
      } else _commonFailure(view, error, again);
    },
  );

  return () => {
    cancelled = true;
    clearInterval(countdown);
    peer.close();
  };
}

/**
 * Joins a room and waits, with no time limit, for the connection.
 * @param {View} view
 * @param {string} code
 * @param {(connection: Connection) => void} onConnected
 * @param {() => void} again
 */
function _guest(view, code, onConnected, again) {
  const { show, t } = view;
  let cancelled = false;
  show(h("h2", {}, t("lobby.joinTitle")), h("p", { "aria-live": "polite" }, t("lobby.joining")));
  const peer = joinPeer(code);
  peer.channel.then(
    (channel) => onConnected({ role: "guest", channel }),
    (error) => {
      if (cancelled) return;
      if (error instanceof RoomGoneError) view.problem("lobby.invalidInvite");
      else _commonFailure(view, error, again);
    },
  );
  return () => {
    cancelled = true;
    peer.close();
  };
}

/**
 * Failures both sides can meet: the Worker can't be reached, or WebRTC gives up.
 * @param {View} view
 * @param {unknown} error
 * @param {() => void} again
 */
function _commonFailure(view, error, again) {
  if (error instanceof ServerUnreachableError || error instanceof ApiError) {
    view.retry("lobby.serverUnreachable", "lobby.retry", again);
  } else if (error instanceof ConnectionFailedError) view.problem("lobby.failed");
  else throw error;
}

/**
 * "Have a code?": joins a friend's room instead of waiting in this one.
 * @param {string} gameId
 * @param {Translate} t
 */
function _codeForm(gameId, t) {
  const input = h("input", {
    class: "lobby-code-input",
    autocomplete: "off",
    autocapitalize: "characters",
    "aria-label": t("lobby.codeLabel"),
    placeholder: "K7P2QX",
  });
  const error = h("p", { class: "lobby-error", "aria-live": "polite" });
  const form = h(
    "form",
    { class: "lobby-code-form" },
    input,
    h("button", { type: "submit" }, t("lobby.join")),
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      location.hash = `#/game/${gameId}/join/${parseRoomCode(input.value)}`;
    } catch (caught) {
      if (!(caught instanceof InvalidRoomCodeError)) throw caught;
      error.textContent = t("lobby.invalidCode");
    }
  });
  return [h("h3", {}, t("lobby.haveCode")), form, error];
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
