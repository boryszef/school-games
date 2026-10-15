import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../helpers/d1.js";
import { createApp } from "../../worker/src/app.js";

const ROOM_TTL_MS = 10 * 60 * 1000;
const CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n";
const ANSWER = "v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\n";

function setup() {
  let clock = 1_700_000_000_000;
  const db = createTestDb();
  const app = createApp({
    db,
    now: () => clock,
    randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size)),
    turn: async () => [],
  });
  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   */
  const call = (method, path, body) =>
    app.handle(
      new Request(`https://worker.test${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const createRoom = async () => {
    const response = await call("POST", "/rooms", { offer: OFFER });
    assert.equal(response.status, 201);
    return /** @type {{code: string}} */ (await response.json()).code;
  };
  return { db, call, createRoom, advance: (/** @type {number} */ ms) => (clock += ms) };
}

test("a new room has a readable code and gives the offer to the guest", async () => {
  const { call, createRoom } = setup();
  const code = await createRoom();
  assert.match(code, CODE_PATTERN);

  const response = await call("GET", `/rooms/${code}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { offer: OFFER });
});

test("room codes always use the readable alphabet", async () => {
  const { createRoom } = setup();
  for (let i = 0; i < 50; i++) assert.match(await createRoom(), CODE_PATTERN);
});

test("the host waits for the answer, gets it once, and then the room is gone", async () => {
  const { call, createRoom } = setup();
  const code = await createRoom();

  assert.equal((await call("GET", `/rooms/${code}/answer`)).status, 204);
  assert.equal((await call("PUT", `/rooms/${code}/answer`, { answer: ANSWER })).status, 204);

  const response = await call("GET", `/rooms/${code}/answer`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answer: ANSWER });

  assert.equal((await call("GET", `/rooms/${code}/answer`)).status, 404);
  assert.equal((await call("GET", `/rooms/${code}`)).status, 404);
});

test("an answered room refuses another guest", async () => {
  const { call, createRoom } = setup();
  const code = await createRoom();
  await call("PUT", `/rooms/${code}/answer`, { answer: ANSWER });

  assert.equal((await call("GET", `/rooms/${code}`)).status, 409);
  assert.equal((await call("PUT", `/rooms/${code}/answer`, { answer: ANSWER })).status, 409);
});

test("a room expires 10 minutes after it was created", async () => {
  const { call, createRoom, advance } = setup();
  const code = await createRoom();

  advance(ROOM_TTL_MS - 1);
  assert.equal((await call("GET", `/rooms/${code}`)).status, 200);

  advance(1);
  assert.equal((await call("GET", `/rooms/${code}`)).status, 404);
  assert.equal((await call("GET", `/rooms/${code}/answer`)).status, 404);
  assert.equal((await call("PUT", `/rooms/${code}/answer`, { answer: ANSWER })).status, 404);
});

test("expired rooms are deleted when a new room is created", async () => {
  const { db, createRoom, advance } = setup();
  await createRoom();
  await createRoom();
  advance(ROOM_TTL_MS);
  const fresh = await createRoom();

  const { results } = await db.prepare("SELECT code FROM rooms").all();
  assert.deepEqual(results, [{ code: fresh }]);
});

test("unknown and malformed room codes are not found", async () => {
  const { call } = setup();
  for (const code of ["ABCDEF", "abcdef", "ABCDE", "ABCDEFG", "ABCDE0"]) {
    assert.equal((await call("GET", `/rooms/${code}`)).status, 404, code);
    assert.equal((await call("GET", `/rooms/${code}/answer`)).status, 404, code);
    assert.equal((await call("PUT", `/rooms/${code}/answer`, { answer: ANSWER })).status, 404);
  }
});

test("an offer or answer must be an SDP text of 1 to 8192 characters", async () => {
  const { call, createRoom } = setup();
  assert.equal((await call("POST", "/rooms", { offer: "x".repeat(8192) })).status, 201);

  const invalid = [{}, { offer: "" }, { offer: 5 }, { offer: "x".repeat(8193) }, null, []];
  for (const body of invalid) {
    assert.equal((await call("POST", "/rooms", body)).status, 400, JSON.stringify(body));
  }

  const code = await createRoom();
  for (const body of [{}, { answer: "" }, { answer: "x".repeat(8193) }]) {
    const response = await call("PUT", `/rooms/${code}/answer`, body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("a missing body is rejected", async () => {
  const { call } = setup();
  assert.equal((await call("POST", "/rooms")).status, 400);
});

test("unknown routes and methods are not found", async () => {
  const { call, createRoom } = setup();
  const code = await createRoom();
  assert.equal((await call("GET", "/")).status, 404);
  assert.equal((await call("GET", "/nope")).status, 404);
  assert.equal((await call("DELETE", `/rooms/${code}`)).status, 404);
  assert.equal((await call("POST", `/rooms/${code}/answer`, { answer: ANSWER })).status, 404);
});
