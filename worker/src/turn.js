/** @typedef {import("./app.js").IceServer} IceServer */

const CREDENTIALS_TTL_S = 3600;
/** Browsers block port 53, so trying those URLs only delays the connection. */
const BLOCKED_PORT = /:53(\?|$)/;

/**
 * Cloudflare TURN: each call gets new STUN and TURN servers with credentials valid for an hour.
 * @param {string} keyId
 * @param {string} apiToken
 * @returns {() => Promise<IceServer[]>}
 */
export function cloudflareTurn(keyId, apiToken) {
  const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;
  return async () => {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: CREDENTIALS_TTL_S }),
    });
    if (!response.ok) throw new Error(`TURN credentials request failed: ${response.status}`);
    /** @type {{iceServers: IceServer[]}} */
    const { iceServers } = await response.json();
    return iceServers.map((server) => ({
      ...server,
      urls: [server.urls].flat().filter((url) => !BLOCKED_PORT.test(url)),
    }));
  };
}
