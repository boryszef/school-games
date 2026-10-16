/** Random ids and tokens, and the token hash that is stored instead of the token. */

const ID_BYTES = 16;
const TOKEN_BYTES = 32;

/** @param {Uint8Array} bytes */
function _base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** @param {(size: number) => Uint8Array} randomBytes 22 base64url characters. */
export const randomId = (randomBytes) => _base64Url(randomBytes(ID_BYTES));

/** @param {(size: number) => Uint8Array} randomBytes 43 base64url characters. */
export const randomToken = (randomBytes) => _base64Url(randomBytes(TOKEN_BYTES));

/** @param {string} token */
export async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return _base64Url(new Uint8Array(digest));
}
