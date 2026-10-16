/** @typedef {{status: number, body?: object, headers?: Record<string, string>}} Reply */

/** The request is malformed; answered with 400. */
export class BadRequestError extends Error {}

/**
 * @param {Request} request
 * @returns {Promise<Record<string, unknown>>} The JSON body, which must be an object.
 * @throws {BadRequestError}
 */
export async function readObject(request) {
  /** @type {unknown} */
  let body;
  try {
    body = JSON.parse(await request.text());
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new BadRequestError("body is not JSON");
  }
  if (!isPlainObject(body)) throw new BadRequestError("body is not an object");
  return body;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} object
 * @param {string[]} keys
 */
export function hasExactly(object, keys) {
  const present = Object.keys(object);
  return present.length === keys.length && keys.every((key) => Object.hasOwn(object, key));
}
