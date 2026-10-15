import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../helpers/d1.js";
import { createApp } from "../../worker/src/app.js";

const ICE_SERVERS = [
  { urls: ["stun:stun.cloudflare.com:3478"] },
  { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "u", credential: "c" },
];

test("GET /turn gives fresh ICE servers from the TURN service for every call", async () => {
  let calls = 0;
  const app = createApp({
    db: createTestDb(),
    now: () => 0,
    randomBytes: (size) => new Uint8Array(size),
    turn: async () => {
      calls++;
      return ICE_SERVERS;
    },
  });
  const get = () => app.handle(new Request("https://worker.test/turn"));

  const response = await get();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { iceServers: ICE_SERVERS });
  await get();
  assert.equal(calls, 2);
});
