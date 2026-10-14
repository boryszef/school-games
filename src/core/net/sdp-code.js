import {
  ByteReader,
  ByteWriter,
  MalformedBytesError,
  fromBase64Url,
  toBase64Url,
} from "./bytes.js";
import { formatIpv6, parseIpv6 } from "./ipv6.js";

/**
 * Packs a WebRTC data-channel session description into a short URL-safe code and back.
 *
 * Only what the connection needs is kept: ICE credentials, the DTLS fingerprint, the setup role
 * and the UDP candidates. Decoding rebuilds a minimal data-channel description around them.
 * Layout (bytes, then base64url): version, flags (type + setup), session id, ufrag, pwd
 * (each length-prefixed), 32-byte SHA-256 fingerprint, candidate count, candidates.
 * A candidate is a kind byte (address form << 2 | candidate type), a 2-byte port and the address.
 */

/** @typedef {"offer" | "answer"} DescriptionType */
/** @typedef {{type: DescriptionType, sdp: string, sessionId: string}} CodedDescription */
/** @typedef {{type: CandidateType, address: string, port: number}} Candidate */
/** @typedef {"host" | "srflx" | "prflx" | "relay"} CandidateType */

export class InvalidCodeError extends Error {
  /** @param {string} reason */
  constructor(reason) {
    super(`Invalid connection code: ${reason}`);
    this.name = "InvalidCodeError";
  }
}

const VERSION = 1;
const TYPES = /** @type {const} */ (["offer", "answer"]);
const SETUPS = /** @type {const} */ (["actpass", "active", "passive"]);
const CANDIDATE_TYPES = /** @type {const} */ (["host", "srflx", "prflx", "relay"]);
/** ICE type preferences (RFC 8445 recommends these values). */
const TYPE_PREFERENCE = { host: 126, prflx: 110, srflx: 100, relay: 0 };
const FINGERPRINT_BYTES = 32;

const ADDRESS_IPV4 = 0;
const ADDRESS_IPV6 = 1;
const ADDRESS_MDNS = 2;
const ADDRESS_NAME = 3;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const MDNS = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/;
const HOST_NAME = /^[\w.-]{1,253}$/;
/** RFC 8839 ice-char, which also keeps decoded values from breaking out of their SDP line. */
const ICE_CHARS = /^[A-Za-z0-9+/]{4,256}$/;
const SESSION_ID = /^[\w-]{1,64}$/;

/**
 * @param {CodedDescription} description
 * @returns {string}
 */
export function encodeDescription({ type, sdp, sessionId }) {
  const lines = sdp.split(/\r?\n/);
  /** @param {string} prefix */
  const value = (prefix) => {
    const line = lines.find((l) => l.startsWith(prefix));
    if (line === undefined) throw new Error(`Session description has no ${prefix} line`);
    return line.slice(prefix.length);
  };
  const [hashName, fingerprint] = value("a=fingerprint:").split(" ");
  if (hashName.toLowerCase() !== "sha-256") throw new Error(`Unsupported fingerprint ${hashName}`);
  const candidates = lines.filter((l) => l.startsWith("a=candidate:")).flatMap(_parseCandidate);

  const out = new ByteWriter();
  out.byte(VERSION);
  out.byte((TYPES.indexOf(type) << 2) | _indexOf(SETUPS, value("a=setup:")));
  out.text(sessionId);
  out.text(value("a=ice-ufrag:"));
  out.text(value("a=ice-pwd:"));
  out.bytes(fingerprint.split(":").map((hex) => parseInt(hex, 16)));
  out.byte(candidates.length);
  for (const candidate of candidates) _writeCandidate(out, candidate);
  return toBase64Url(out.result());
}

/**
 * Keeps UDP candidates only: data channels never need TCP ones.
 * @param {string} line `a=candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> ...`
 * @returns {Candidate[]}
 */
function _parseCandidate(line) {
  const [, , transport, , address, port, , type] = line.split(" ");
  if (transport.toLowerCase() !== "udp") return [];
  return [{ type: CANDIDATE_TYPES[_indexOf(CANDIDATE_TYPES, type)], address, port: Number(port) }];
}

/**
 * @param {ByteWriter} out
 * @param {Candidate} candidate
 */
function _writeCandidate(out, { type, address, port }) {
  const typeIndex = _indexOf(CANDIDATE_TYPES, type);
  const ipv4 = IPV4.exec(address);
  const mdns = MDNS.exec(address);
  if (ipv4 !== null) {
    out.byte((ADDRESS_IPV4 << 2) | typeIndex);
    out.port(port);
    out.bytes(ipv4.slice(1).map(Number));
  } else if (address.includes(":")) {
    out.byte((ADDRESS_IPV6 << 2) | typeIndex);
    out.port(port);
    out.bytes(parseIpv6(address));
  } else if (mdns !== null) {
    out.byte((ADDRESS_MDNS << 2) | typeIndex);
    out.port(port);
    out.bytes(_hexBytes(mdns.slice(1).join("")));
  } else {
    out.byte((ADDRESS_NAME << 2) | typeIndex);
    out.port(port);
    out.text(address);
  }
}

/**
 * @param {string} code
 * @returns {CodedDescription}
 * @throws {InvalidCodeError}
 */
export function decodeDescription(code) {
  try {
    return _decode(code);
  } catch (error) {
    if (error instanceof MalformedBytesError) throw new InvalidCodeError(error.message);
    throw error;
  }
}

/** @param {string} code */
function _decode(code) {
  const input = new ByteReader(fromBase64Url(code));
  if (input.byte() !== VERSION) throw new InvalidCodeError("unknown version");
  const flags = input.byte();
  const type = _pick(TYPES, flags >> 2, "type");
  const setup = _pick(SETUPS, flags & 0b11, "setup role");
  const sessionId = _checked(input.text(), SESSION_ID, "session id");
  const ufrag = _checked(input.text(), ICE_CHARS, "ICE username");
  const pwd = _checked(input.text(), ICE_CHARS, "ICE password");
  const fingerprint = input.bytes(FINGERPRINT_BYTES);
  const candidates = Array.from({ length: input.byte() }, () => _readCandidate(input));
  input.end();
  const sdp = _buildSdp({ setup, ufrag, pwd, fingerprint, candidates });
  return { type, sdp, sessionId };
}

/**
 * @param {ByteReader} input
 * @returns {Candidate}
 */
function _readCandidate(input) {
  const kind = input.byte();
  const type = _pick(CANDIDATE_TYPES, kind & 0b11, "candidate type");
  const port = input.port();
  /** @type {Record<number, () => string>} */
  const readers = {
    [ADDRESS_IPV4]: () => input.bytes(4).join("."),
    [ADDRESS_IPV6]: () => formatIpv6(input.bytes(16)),
    [ADDRESS_MDNS]: () => _formatUuid(input.bytes(16)) + ".local",
    [ADDRESS_NAME]: () => _checked(input.text(), HOST_NAME, "candidate address"),
  };
  const read = readers[kind >> 2];
  if (read === undefined) throw new InvalidCodeError("unknown address form");
  return { type, address: read(), port };
}

/**
 * @param {{setup: string, ufrag: string, pwd: string, fingerprint: number[], candidates: Candidate[]}} parts
 */
function _buildSdp({ setup, ufrag, pwd, fingerprint, candidates }) {
  const lines = [
    "v=0",
    "o=- 0 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    ...candidates.map(_candidateLine),
    "a=end-of-candidates",
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=fingerprint:sha-256 ${fingerprint.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":")}`,
    `a=setup:${setup}`,
    "a=mid:0",
    "a=sctp-port:5000",
    "a=max-message-size:262144",
  ];
  return lines.join("\r\n") + "\r\n";
}

/**
 * @param {Candidate} candidate
 * @param {number} index
 */
function _candidateLine({ type, address, port }, index) {
  const priority = TYPE_PREFERENCE[type] * 2 ** 24 + (65535 - index) * 2 ** 8 + 255;
  const related = type === "host" ? "" : " raddr 0.0.0.0 rport 0";
  return `a=candidate:${index + 1} 1 udp ${priority} ${address} ${port} typ ${type}${related}`;
}

/**
 * Position of a value the browser produced; anything else is unexpected.
 * @param {readonly string[]} values
 * @param {string} value
 */
function _indexOf(values, value) {
  const index = values.indexOf(value);
  if (index === -1) throw new Error(`Unexpected value in session description: ${value}`);
  return index;
}

/**
 * @template T
 * @param {readonly T[]} values
 * @param {number} index
 * @param {string} what
 */
function _pick(values, index, what) {
  if (index >= values.length) throw new InvalidCodeError(`unknown ${what}`);
  return values[index];
}

/**
 * @param {string} value
 * @param {RegExp} pattern
 * @param {string} what
 */
function _checked(value, pattern, what) {
  if (!pattern.test(value)) throw new InvalidCodeError(`bad ${what}`);
  return value;
}

/** @param {string} hex */
function _hexBytes(hex) {
  return Array.from({ length: hex.length / 2 }, (_, i) =>
    parseInt(hex.slice(2 * i, 2 * i + 2), 16),
  );
}

/** @param {number[]} bytes 16 bytes */
function _formatUuid(bytes) {
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
