import { log } from "../log.js";
import { callApi } from "../online/api.js";

/**
 * Direct browser-to-browser connection over a WebRTC data channel. The Worker only passes the
 * offer and answer between the players (through a room code) and hands out TURN servers, which
 * relay the traffic when a direct path is blocked.
 */

/**
 * @typedef {object} Channel JSON messages to and from the other player.
 * @property {(message: object) => void} send
 * @property {(listener: (raw: string) => void) => void} onMessage Receives the raw JSON text.
 * @property {(listener: () => void) => void} onClose Called once when the connection is lost.
 * @property {() => void} close
 */

/**
 * `timeout`: the channel did not open in time; `failed`: the browser gave up on the connection.
 * @typedef {"timeout" | "failed"} FailureReason
 */

export class ConnectionFailedError extends Error {
  /** @param {FailureReason} reason */
  constructor(reason) {
    super(`Could not connect to the other player (${reason})`);
    this.name = "ConnectionFailedError";
    this.reason = reason;
  }
}

/** The host's room expired before a guest answered. */
export class RoomExpiredError extends Error {
  constructor() {
    super("The invitation expired");
    this.name = "RoomExpiredError";
  }
}

/** The guest's room is unknown, expired or already taken by another guest. */
export class RoomGoneError extends Error {
  constructor() {
    super("The invitation is no longer valid");
    this.name = "RoomGoneError";
  }
}

/** Gathering can hang on an unreachable STUN/TURN server; after this the found candidates go. */
const GATHERING_CAP_MS = 3000;
/** How long the host waits for the channel to open after receiving the answer. */
export const CONNECT_TIMEOUT_MS = 60000;
const ANSWER_POLL_MS = 1500;

/**
 * @typedef {object} HostEvents
 * @property {(code: string) => void} onCode The room exists; the guest can join with this code.
 * @property {() => void} onAnswer A guest answered; connecting starts.
 */

/**
 * The inviting side: opens a room and waits for a guest.
 * @param {HostEvents} events
 * @returns {{channel: Promise<Channel>, close: () => void}} `channel` rejects with
 *   ServerUnreachableError, ApiError, RoomExpiredError or ConnectionFailedError.
 */
export function hostPeer({ onCode, onAnswer }) {
  const session = _session();
  const channel = (async () => {
    const { connection, dataChannel } = await session.open();
    await connection.setLocalDescription();
    const offer = await _gatheredSdp(connection);
    const { data } = await callApi("POST", "/rooms", { body: { offer }, expect: [201] });
    log.debug("room created", data.code);
    onCode(data.code);
    const answer = await _pollAnswer(data.code, session.isClosed);
    onAnswer();
    await connection.setRemoteDescription({ type: "answer", sdp: answer });
    return _whenOpen(connection, dataChannel, CONNECT_TIMEOUT_MS);
  })();
  return { channel, close: session.close };
}

/**
 * The invited side: answers the room's offer and waits, with no time limit, for the host.
 * @param {string} code
 * @returns {{channel: Promise<Channel>, close: () => void}} `channel` rejects with
 *   ServerUnreachableError, ApiError, RoomGoneError or ConnectionFailedError.
 */
export function joinPeer(code) {
  const session = _session();
  const channel = (async () => {
    const room = await callApi("GET", `/rooms/${code}`, { expect: [200, 404, 409] });
    if (room.status !== 200) throw new RoomGoneError();
    const { connection, dataChannel } = await session.open();
    await connection.setRemoteDescription({ type: "offer", sdp: room.data.offer });
    await connection.setLocalDescription();
    const answer = await _gatheredSdp(connection);
    const sent = await callApi("PUT", `/rooms/${code}/answer`, {
      body: { answer },
      expect: [204, 404, 409],
    });
    if (sent.status !== 204) throw new RoomGoneError();
    return _whenOpen(connection, dataChannel, null);
  })();
  return { channel, close: session.close };
}

/** One connection attempt; closing it also closes a connection that is still being set up. */
function _session() {
  let closed = false;
  /** @type {RTCPeerConnection | undefined} */
  let connection;
  return {
    async open() {
      const { data } = await callApi("GET", "/turn", { expect: [200] });
      log.debug("ICE servers", data.iceServers.length);
      connection = new RTCPeerConnection({ iceServers: data.iceServers });
      if (closed) connection.close();
      const dataChannel = connection.createDataChannel("game", { negotiated: true, id: 0 });
      const opened = connection;
      opened.addEventListener("connectionstatechange", () =>
        log.debug("peer connection", opened.connectionState),
      );
      return { connection: opened, dataChannel };
    },
    isClosed: () => closed,
    close() {
      closed = true;
      connection?.close();
    },
  };
}

/**
 * Waits for all ICE candidates (non-trickle) and returns the complete local description.
 * @param {RTCPeerConnection} connection
 */
async function _gatheredSdp(connection) {
  await _gathered(connection);
  const sdp = /** @type {RTCSessionDescription} */ (connection.localDescription).sdp;
  log.debug("local description", {
    length: sdp.length,
    candidates: sdp.split("a=candidate:").length - 1,
    relay: sdp.split(" typ relay").length - 1,
  });
  return sdp;
}

/** @param {RTCPeerConnection} connection */
function _gathered(connection) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      log.debug("ICE gathering capped");
      resolve(undefined);
    }, GATHERING_CAP_MS);
    const check = () => {
      if (connection.iceGatheringState !== "complete") return;
      clearTimeout(timer);
      resolve(undefined);
    };
    connection.addEventListener("icegatheringstatechange", check);
    check();
  });
}

/**
 * Asks for the guest's answer until it arrives. Never settles once the session is closed.
 * @param {string} code
 * @param {() => boolean} isClosed
 * @returns {Promise<string>}
 * @throws {RoomExpiredError}
 */
async function _pollAnswer(code, isClosed) {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, ANSWER_POLL_MS));
    if (isClosed()) return new Promise(() => {});
    const { status, data } = await callApi("GET", `/rooms/${code}/answer`, {
      expect: [200, 204, 404],
    });
    if (status === 200) return data.answer;
    if (status === 404) throw new RoomExpiredError();
  }
}

/**
 * @param {RTCPeerConnection} connection
 * @param {RTCDataChannel} dataChannel
 * @param {number | null} timeoutMs
 * @returns {Promise<Channel>}
 */
function _whenOpen(connection, dataChannel, timeoutMs) {
  return new Promise((resolve, reject) => {
    /** @param {FailureReason} reason */
    const fail = (reason) => {
      clearTimeout(timer);
      connection.close();
      reject(new ConnectionFailedError(reason));
    };
    const timer = timeoutMs === null ? undefined : setTimeout(() => fail("timeout"), timeoutMs);
    connection.addEventListener("connectionstatechange", () => {
      if (connection.connectionState === "failed" && dataChannel.readyState !== "open") {
        fail("failed");
      }
    });
    dataChannel.addEventListener("open", () => {
      clearTimeout(timer);
      log.info("connected to the other player");
      resolve(_channel(connection, dataChannel));
    });
  });
}

/**
 * @param {RTCPeerConnection} connection
 * @param {RTCDataChannel} dataChannel
 * @returns {Channel}
 */
function _channel(connection, dataChannel) {
  /** @type {(() => void)[]} */
  const closeListeners = [];
  let closed = false;
  const lost = () => {
    if (closed) return;
    closed = true;
    log.info("connection to the other player lost");
    for (const listener of closeListeners) listener();
  };
  dataChannel.addEventListener("close", lost);
  connection.addEventListener("connectionstatechange", () => {
    if (["failed", "closed"].includes(connection.connectionState)) lost();
  });

  return {
    send: (message) => dataChannel.send(JSON.stringify(message)),
    onMessage: (listener) =>
      dataChannel.addEventListener("message", (event) => listener(String(event.data))),
    onClose: (listener) => closeListeners.push(listener),
    close() {
      closed = true;
      connection.close();
    },
  };
}
