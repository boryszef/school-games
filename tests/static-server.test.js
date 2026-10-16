import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { startStaticServer } from "../scripts/static-server.js";

const root = new URL("../", import.meta.url).pathname;
/** @type {import("node:http").Server} */
let server;
let base = "";
before(async () => {
  server = await startStaticServer(root, 0, "127.0.0.1");
  base = `http://127.0.0.1:${/** @type {import("node:net").AddressInfo} */ (server.address()).port}`;
});
after(() => server.close());

test("files are never cached, so a reload always runs the current code", async () => {
  // Browsers kept running old game modules after they had been edited.
  for (const path of ["/", "/src/games/robot-maze/index.js", "/css/base.css"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
  }
});

test("files are served with the types the browser needs", async () => {
  const types = {
    "/index.html": "text/html; charset=utf-8",
    "/src/main.js": "text/javascript; charset=utf-8",
    "/css/base.css": "text/css; charset=utf-8",
    "/fonts/emoji-subset.woff2": "font/woff2",
  };
  for (const [path, type] of Object.entries(types)) {
    const response = await fetch(base + path);
    assert.equal(response.headers.get("content-type"), type, path);
  }
  const page = await fetch(`${base}/`);
  assert.match(await page.text(), /<html/i);
});

test("missing files and paths outside the repository are not found", async () => {
  for (const path of ["/nope.js", "/src/../../../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});
