import { test } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidCodeError,
  decodeDescription,
  encodeDescription,
} from "../src/core/net/sdp-code.js";
import { CHROME_ANSWER, CHROME_OFFER, FIREFOX_OFFER, SAFARI_ANSWER } from "./fixtures/sdp.js";

/** @typedef {{type: "offer" | "answer", sdp: string}} Description */

/** Browsers produce CRLF line endings. */
const crlf = (/** @type {string} */ sdp) => sdp.replaceAll("\n", "\r\n");

/** @type {[string, Description][]} */
const FIXTURES = [
  ["Chrome offer", { type: "offer", sdp: crlf(CHROME_OFFER) }],
  ["Chrome answer", { type: "answer", sdp: crlf(CHROME_ANSWER) }],
  ["Firefox offer", { type: "offer", sdp: crlf(FIREFOX_OFFER) }],
  ["Safari answer", { type: "answer", sdp: crlf(SAFARI_ANSWER) }],
];

const MAX_CODE_LENGTH = 300;

/**
 * The parts of a description the connection depends on.
 * @param {string} sdp
 */
function essentials(sdp) {
  const lines = sdp.split(/\r?\n/);
  /** @param {string} prefix */
  const value = (prefix) => lines.find((line) => line.startsWith(prefix))?.slice(prefix.length);
  const candidates = lines
    .filter((line) => line.startsWith("a=candidate:"))
    .map((line) => line.split(" "))
    .filter((parts) => parts[2].toLowerCase() === "udp")
    .map((parts) => ({ address: parts[4], port: parts[5], type: parts[7] }));
  return {
    ufrag: value("a=ice-ufrag:"),
    pwd: value("a=ice-pwd:"),
    fingerprint: value("a=fingerprint:"),
    setup: value("a=setup:"),
    candidates,
  };
}

for (const [name, description] of FIXTURES) {
  test(`${name}: the decoded description keeps everything the connection needs`, () => {
    const code = encodeDescription({ ...description, sessionId: "s3ss10n" });
    const decoded = decodeDescription(code);
    assert.equal(decoded.type, description.type);
    assert.equal(decoded.sessionId, "s3ss10n");
    assert.deepEqual(essentials(decoded.sdp), essentials(description.sdp));
  });

  test(`${name}: the code is short and URL-safe`, () => {
    const code = encodeDescription({ ...description, sessionId: "s3ss10n" });
    assert.match(code, /^[\w-]+$/);
    assert.ok(code.length <= MAX_CODE_LENGTH, `code has ${code.length} characters`);
  });
}

test("the decoded description is a CRLF data-channel description", () => {
  const { sdp } = decodeDescription(
    encodeDescription({ type: "offer", sdp: crlf(CHROME_OFFER), sessionId: "abc" }),
  );
  assert.match(sdp, /^v=0\r\n/);
  assert.match(sdp, /\r\nm=application \d+ UDP\/DTLS\/SCTP webrtc-datachannel\r\n/);
  assert.match(sdp, /\r\na=mid:0\r\n/);
  assert.match(sdp, /\r\na=group:BUNDLE 0\r\n/);
  assert.match(sdp, /\r\na=sctp-port:5000\r\n/);
  assert.ok(sdp.endsWith("\r\n"));
});

test("TCP candidates are dropped, because data channels only need UDP", () => {
  const { sdp } = decodeDescription(
    encodeDescription({ type: "answer", sdp: crlf(SAFARI_ANSWER), sessionId: "abc" }),
  );
  assert.doesNotMatch(sdp, / tcp /i);
});

test("malformed codes are rejected with InvalidCodeError", () => {
  const valid = encodeDescription({ type: "offer", sdp: crlf(CHROME_OFFER), sessionId: "abc" });
  for (const code of ["", "!!!", "abc", valid.slice(0, valid.length / 2)]) {
    assert.throws(() => decodeDescription(code), InvalidCodeError, `accepted ${code}`);
  }
});
