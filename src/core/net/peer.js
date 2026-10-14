import { log } from "../log.js";
import { toBase64Url } from "./bytes.js";
import { InvalidCodeError, decodeDescription, encodeDescription } from "./sdp-code.js";

/**
 * Direct browser-to-browser connection over a WebRTC data channel, with no signalling server:
 * the offer and answer codes are carried between the players by hand (link, QR code, paste).
 */

/**
 * @typedef {object} Channel JSON messages to and from the other player.
 * @property {(message: object) => void} send
 * @property {(listener: (raw: string) => void) => void} onMessage Receives the raw JSON text.
 * @property {(listener: () => void) => void} onClose Called once when the connection is lost.
 * @property {() => void} close
 */

export class ConnectionFailedError extends Error {
  constructor() {
    super("Could not connect to the other player");
    this.name = "ConnectionFailedError";
  }
}

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
/** Gathering can hang on an unreachable STUN server; after this the code uses what was found. */
const GATHERING_CAP_MS = 3000;
/** How long the host waits for the channel to open after receiving the answer. */
const CONNECT_TIMEOUT_MS = 20000;
const SESSION_ID_BYTES = 6;

/** The inviting side: makes the offer code and accepts the answer code. */
export function hostPeer() {
  const { connection, dataChannel } = _createConnection();
  const sessionId = toBase64Url(crypto.getRandomValues(new Uint8Array(SESSION_ID_BYTES)));
  const offerCode = (async () => {
    await connection.setLocalDescription();
    return _localCode(connection, "offer", sessionId);
  })();

  return {
    sessionId,
    /** @type {Promise<string>} */
    offerCode,
    /**
     * @param {string} answerCode
     * @returns {Promise<Channel>}
     * @throws {InvalidCodeError} Right away when the code is malformed or answers another invitation.
     */
    accept(answerCode) {
      const answer = decodeDescription(answerCode);
      if (answer.type !== "answer") throw new InvalidCodeError("not an answer");
      if (answer.sessionId !== sessionId)
        throw new InvalidCodeError("answer to another invitation");
      return connection
        .setRemoteDescription({ type: "answer", sdp: answer.sdp })
        .then(() => _whenOpen(connection, dataChannel, CONNECT_TIMEOUT_MS));
    },
    close: () => connection.close(),
  };
}

/**
 * The invited side: answers the host's offer code.
 * @param {string} offerCode
 * @throws {InvalidCodeError}
 */
export function joinPeer(offerCode) {
  const offer = decodeDescription(offerCode);
  if (offer.type !== "offer") throw new InvalidCodeError("not an invitation");
  const { connection, dataChannel } = _createConnection();
  const answerCode = (async () => {
    await connection.setRemoteDescription({ type: "offer", sdp: offer.sdp });
    await connection.setLocalDescription();
    return _localCode(connection, "answer", offer.sessionId);
  })();

  return {
    /** @type {Promise<string>} */
    answerCode,
    /** Opens once the host has received the answer; no timeout, since that can take a while. */
    channel: _whenOpen(connection, dataChannel, null),
    close: () => connection.close(),
  };
}

function _createConnection() {
  const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const dataChannel = connection.createDataChannel("game", { negotiated: true, id: 0 });
  connection.addEventListener("connectionstatechange", () =>
    log.debug("peer connection", connection.connectionState),
  );
  return { connection, dataChannel };
}

/**
 * Waits for all ICE candidates (non-trickle), then packs the local description.
 * @param {RTCPeerConnection} connection
 * @param {import("./sdp-code.js").DescriptionType} type
 * @param {string} sessionId
 */
async function _localCode(connection, type, sessionId) {
  await _gathered(connection);
  const sdp = /** @type {RTCSessionDescription} */ (connection.localDescription).sdp;
  const code = encodeDescription({ type, sdp, sessionId });
  log.debug(`${type} code`, {
    sdpLength: sdp.length,
    codeLength: code.length,
    candidates: sdp.split("a=candidate:").length - 1,
  });
  return code;
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
 * @param {RTCPeerConnection} connection
 * @param {RTCDataChannel} dataChannel
 * @param {number | null} timeoutMs
 * @returns {Promise<Channel>}
 */
function _whenOpen(connection, dataChannel, timeoutMs) {
  return new Promise((resolve, reject) => {
    const fail = () => {
      connection.close();
      reject(new ConnectionFailedError());
    };
    const timer = timeoutMs === null ? undefined : setTimeout(fail, timeoutMs);
    connection.addEventListener("connectionstatechange", () => {
      if (connection.connectionState === "failed" && dataChannel.readyState !== "open") fail();
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
