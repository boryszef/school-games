import { test } from "node:test";
import assert from "node:assert/strict";

// api.js picks its address when imported; any host will do for testing apiUrlFor.
Object.assign(globalThis, { location: new URL("http://localhost:8000/") });
const { apiUrlFor } = await import("../src/core/online/api.js");

test("only the published site talks to the production Worker", () => {
  assert.equal(apiUrlFor("boryszef.github.io"), "https://school-games.boryszef.workers.dev");
});

test("any other host talks to the local Worker on that host", () => {
  for (const host of ["localhost", "127.0.0.1", "192.168.1.20"]) {
    assert.equal(apiUrlFor(host), `http://${host}:8787`);
  }
});
