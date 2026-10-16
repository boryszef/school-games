import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

/** The file types the game uses; anything else is served as plain bytes. */
const TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
]);

/**
 * Serves the game's files for local testing. Nothing is cached, so a reload always runs the
 * code as it is on disk.
 * @param {string} root
 * @param {number} port
 * @param {string} host
 * @returns {Promise<import("node:http").Server>}
 */
export function startStaticServer(root, port, host) {
  const base = resolve(root);
  const server = createServer(async (request, response) => {
    const path = await _file(base, new URL(request.url ?? "/", "http://local").pathname);
    if (path === null) {
      response.writeHead(404, { "Cache-Control": "no-store" }).end();
      return;
    }
    response
      .writeHead(200, {
        "Content-Type": TYPES.get(extname(path)) ?? "application/octet-stream",
        "Cache-Control": "no-store",
      })
      .end(await readFile(path));
  });
  return new Promise((ready) => server.listen(port, host, () => ready(server)));
}

/**
 * @param {string} base
 * @param {string} urlPath
 * @returns {Promise<string | null>} The file to serve, or null when there is none under `base`.
 */
async function _file(base, urlPath) {
  const path = resolve(join(base, decodeURIComponent(urlPath)));
  if (path !== base && !path.startsWith(base + sep)) return null;
  try {
    const info = await stat(path);
    if (info.isFile()) return path;
    if (info.isDirectory()) return _file(base, join(urlPath, "index.html"));
    return null;
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return null;
    throw error;
  }
}
