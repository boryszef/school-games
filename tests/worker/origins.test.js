import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../../worker/src/index.js";

test("the deployed Worker accepts only the published site", () => {
  assert.equal(isAllowedOrigin("https://boryszef.github.io", {}), true);
  for (const origin of [
    "http://localhost:8000",
    "http://192.168.1.20:8000",
    "https://evil.example",
  ]) {
    assert.equal(isAllowedOrigin(origin, {}), false, origin);
  }
});

test("the local Worker also accepts the origins npm run dev lists", () => {
  const env = { DEV_ORIGINS: "http://localhost:8000,http://192.168.1.20:8000" };
  assert.equal(isAllowedOrigin("http://localhost:8000", env), true);
  assert.equal(isAllowedOrigin("http://192.168.1.20:8000", env), true);
  assert.equal(isAllowedOrigin("https://boryszef.github.io", env), true);
  assert.equal(isAllowedOrigin("http://192.168.1.21:8000", env), false);
});

test("requests without an Origin header are allowed, as from curl", () => {
  assert.equal(isAllowedOrigin(null, {}), true);
});
