import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../helpers/d1.js";
import { createApp } from "../../worker/src/app.js";

test("GET /ice-servers gives Cloudflare's free STUN server", async () => {
  const app = createApp({
    db: createTestDb(),
    now: () => 0,
    randomBytes: (size) => new Uint8Array(size),
  });

  const response = await app.handle(new Request("https://worker.test/ice-servers"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  });
});
