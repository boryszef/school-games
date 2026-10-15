/** Room codes name a waiting two-player game on the Worker; shared by the app and the Worker. */

/** No 0/O, 1/I/L, so a code can be read aloud and typed without mistakes. */
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export class InvalidRoomCodeError extends Error {
  /** @param {string} input */
  constructor(input) {
    super(`Not a room code: "${input}"`);
    this.name = "InvalidRoomCodeError";
  }
}

/**
 * @param {Uint8Array} bytes One random byte per character.
 * @returns {string}
 */
export function roomCodeFrom(bytes) {
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
}

/**
 * Reads a typed code or a whole invitation link, ignoring case and spaces.
 * @param {string} input
 * @returns {string}
 * @throws {InvalidRoomCodeError}
 */
export function parseRoomCode(input) {
  const code = input
    .replace(/^.*\/join\//s, "")
    .replace(/\s/g, "")
    .toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) throw new InvalidRoomCodeError(input);
  return code;
}
