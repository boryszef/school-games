import { ROPE_TO_WIN } from "./match.js";

/**
 * Messages between the two players. The host sends `hello`, `start`, `question`, `tug` and
 * `end`; the guest sends `hello` and `answer`. Everything received is validated, since it comes
 * from another device.
 */

/** @typedef {import("./match.js").Side} Side */
/**
 * @typedef {{type: "hello", name: string}
 *   | {type: "start"}
 *   | {type: "question", round: number, a: number, b: number}
 *   | {type: "tug", round: number, winner: Side, rope: number}
 *   | {type: "end", winner: Side}} HostMessage
 */
/**
 * @typedef {{type: "hello", name: string}
 *   | {type: "answer", round: number, value: number, reactionMs: number}} GuestMessage
 */

export class InvalidMessageError extends Error {
  /** @param {string} raw */
  constructor(raw) {
    super(`Invalid message from the other player: ${raw.slice(0, 200)}`);
    this.name = "InvalidMessageError";
  }
}

/** @typedef {(value: unknown) => boolean} Check */

const MAX_NAME_LENGTH = 20;

/** @type {(min: number, max: number) => Check} */
const integerIn = (min, max) => (v) => Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
/** @type {Check} */
const round = integerIn(1, Number.MAX_SAFE_INTEGER);
/** @type {Check} */
const factor = integerIn(2, 10);
/** @type {Check} */
const side = (v) => v === "host" || v === "guest";
/** @type {Check} */
const name = (v) => typeof v === "string" && v.length >= 1 && v.length <= MAX_NAME_LENGTH;

/** @type {Record<string, Record<string, Check>>} */
const HOST_MESSAGES = {
  hello: { name },
  start: {},
  question: { round, a: factor, b: factor },
  tug: { round, winner: side, rope: integerIn(-ROPE_TO_WIN, ROPE_TO_WIN) },
  end: { winner: side },
};

/** @type {Record<string, Record<string, Check>>} */
const GUEST_MESSAGES = {
  hello: { name },
  answer: {
    round,
    value: integerIn(0, Number.MAX_SAFE_INTEGER),
    reactionMs: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0,
  },
};

/**
 * @param {string} raw
 * @returns {HostMessage}
 * @throws {InvalidMessageError}
 */
export function parseHostMessage(raw) {
  return /** @type {HostMessage} */ (_parse(raw, HOST_MESSAGES));
}

/**
 * @param {string} raw
 * @returns {GuestMessage}
 * @throws {InvalidMessageError}
 */
export function parseGuestMessage(raw) {
  return /** @type {GuestMessage} */ (_parse(raw, GUEST_MESSAGES));
}

/**
 * @param {string} raw
 * @param {Record<string, Record<string, Check>>} schemas
 */
function _parse(raw, schemas) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) throw new InvalidMessageError(raw);
    throw error;
  }
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    throw new InvalidMessageError(raw);
  }
  const schema = Object.hasOwn(schemas, message.type) ? schemas[message.type] : undefined;
  if (schema === undefined) throw new InvalidMessageError(raw);
  const fields = Object.keys(message).filter((key) => key !== "type");
  const valid =
    fields.length === Object.keys(schema).length &&
    Object.entries(schema).every(
      ([key, check]) => Object.hasOwn(message, key) && check(message[key]),
    );
  if (!valid) throw new InvalidMessageError(raw);
  return message;
}
