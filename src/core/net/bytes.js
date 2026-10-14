/** Raised when bytes from outside (a code typed or scanned by a user) are not well-formed. */
export class MalformedBytesError extends Error {
  /** @param {string} reason */
  constructor(reason) {
    super(reason);
    this.name = "MalformedBytesError";
  }
}

const MAX_TEXT_BYTES = 255;
const BASE64URL = /^[\w-]*$/;

/** Appends bytes, 2-byte ports and length-prefixed UTF-8 texts. */
export class ByteWriter {
  /** @type {number[]} */
  #bytes = [];

  /** @param {number} value 0–255 */
  byte(value) {
    this.#bytes.push(value);
  }

  /** @param {number[]} values */
  bytes(values) {
    this.#bytes.push(...values);
  }

  /** @param {number} value 0–65535 */
  port(value) {
    this.#bytes.push(value >> 8, value & 0xff);
  }

  /** @param {string} value */
  text(value) {
    const encoded = new TextEncoder().encode(value);
    if (encoded.length > MAX_TEXT_BYTES) throw new Error(`Text too long to encode: ${value}`);
    this.#bytes.push(encoded.length, ...encoded);
  }

  result() {
    return Uint8Array.from(this.#bytes);
  }
}

/** Reads what `ByteWriter` wrote; running out of bytes is a `MalformedBytesError`. */
export class ByteReader {
  #bytes;
  #offset = 0;

  /** @param {Uint8Array} bytes */
  constructor(bytes) {
    this.#bytes = bytes;
  }

  byte() {
    return this.bytes(1)[0];
  }

  /** @param {number} count */
  bytes(count) {
    if (this.#offset + count > this.#bytes.length) throw new MalformedBytesError("data too short");
    const slice = [...this.#bytes.subarray(this.#offset, this.#offset + count)];
    this.#offset += count;
    return slice;
  }

  port() {
    const [high, low] = this.bytes(2);
    return (high << 8) | low;
  }

  text() {
    const bytes = Uint8Array.from(this.bytes(this.byte()));
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      if (error instanceof TypeError) throw new MalformedBytesError("text is not UTF-8");
      throw error;
    }
  }

  /** Fails when bytes are left over. */
  end() {
    if (this.#offset !== this.#bytes.length) throw new MalformedBytesError("unexpected extra data");
  }
}

/** @param {Uint8Array} bytes */
export function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** @param {string} text */
export function fromBase64Url(text) {
  if (!BASE64URL.test(text) || text.length % 4 === 1)
    throw new MalformedBytesError("not base64url");
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
