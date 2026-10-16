# Plan: PvP rooms through a Cloudflare Worker

## Summary

Two-player games no longer need the manual two-way code exchange. A small Cloudflare Worker (free tier, with D1 as its database) passes the WebRTC offer and answer between the players:

- The host gets a 6-character room code, such as `K7P2QX`, and shows it as large letters, a QR code and a link.
- The guest opens the link or types the code. The browsers then connect directly as before.
- The Worker also tells the browsers which STUN server to use: Cloudflare's, which is free and unlimited. There is no TURN relay (see Context), so networks that block direct connections still can't connect.
- Rooms are anonymous, expire after 10 minutes and are deleted as soon as the host has the answer.
- The answer link, the relay tab, the paste box and the SDP compression code are removed.

This is part 1 of two. Part 2, an online hall of fame, reuses the same Worker.

## Context

- The manual exchange (plan-tug-of-war.md) works, but it is clumsy for children: the guest must send a second link back, and the host must open it in the same browser or paste it.
- Headless tests showed that with STUN only, networks that block direct paths fail after about 15 s.
- The user wants no hosting costs. Cloudflare's free tier (about 100k Worker requests/day, 5 GB D1, no pausing) covers this.
- Cloudflare TURN has 1,000 GB a month free, but it can only be activated with a payment card, and usage above the allowance is billed with no cap. Since `/ice-servers` is public, anyone could fetch relay credentials and run up a bill. The user decided not to add a card, so there is no TURN for now. Because the app gets its ICE servers from the Worker, TURN can be added later without changing the app.

The user's decisions:

- Worker-only signalling, with no manual fallback.
- STUN only (no card on file, so no possible bill).
- Anonymous rooms that don't require joining the hall of fame.

## Worker (`worker/`)

- `wrangler.jsonc`: the D1 binding `DB` and the rate-limit binding `ROOMS_LIMIT`.
- `migrations/0001_rooms.sql`: `rooms(code TEXT PRIMARY KEY, offer TEXT NOT NULL, answer TEXT, created_at INTEGER NOT NULL)`.
- `src/index.js`: the Worker entry. It handles CORS for the GitHub Pages origin and `http://localhost:8000`, per-IP rate limits via Cloudflare's rate-limit binding (no IPs are stored), and builds the app from `env`.
- `src/app.js`: `createApp({db, now, randomBytes})` → `handle(request)`. Routing, and the fixed ICE server list.
- `src/rooms.js`: the room logic.

| Method and path                      | Result                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `POST /rooms` `{offer}`              | 201 `{code}`. 400 if `offer` is not a string of 1–8192 characters.                         |
| `GET /rooms/:code`                   | 200 `{offer}`. 404 if the room is unknown or expired, 409 if it is already answered.       |
| `PUT /rooms/:code/answer` `{answer}` | 204. 404 if unknown or expired, 409 if already answered, 400 for a bad body.               |
| `GET /rooms/:code/answer`            | 200 `{answer}`, which also deletes the room. 204 while waiting, 404 if unknown or expired. |
| `GET /ice-servers`                   | 200 `{iceServers}`: Cloudflare's STUN server.                                              |

- Room codes are 6 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no `0 O 1 I L`). The alphabet lives in `src/core/net/room-code.js`, which the Worker imports.
- A room expires 10 minutes after creation. Expired rooms are deleted whenever a new room is created.

## Browser

- `src/core/online/api.js`: `API_URL` and a JSON `fetch` helper that throws `ApiError(status)` for unexpected statuses.
- `src/core/net/room-code.js`: `parseRoomCode(input)` takes a code or a full invitation link, ignores case and spaces, and throws `InvalidRoomCodeError`.
- `src/core/net/peer.js`:
  - First fetches `iceServers` from `/ice-servers`.
  - `hostPeer()` posts the offer, then polls for the answer every 1.5 s and connects once it arrives, with the existing 60 s timeout.
  - `joinPeer(code)` fetches the offer and puts the answer.
  - Non-trickle ICE with the 3 s gathering cap stays.
- `src/core/ui/pvp-lobby.js`:
  - The host sees the code, the QR code, the link with a copy button, and a "Have a code?" box.
  - Room expired → "This invitation has expired" with **New invitation**.
  - On the guest, an unknown or answered room → "This invitation is no longer valid".
  - Worker unreachable → "Can't reach the game server" with **Try again**.
  - The countdown, timeout and "failed" views stay.
- **Removed:**
  - `sdp-code.js`, `ipv6.js`, `bytes.js` and `answer-relay.js`;
  - the `answer/<code>` lobby mode and the paste form;
  - the SDP fixtures and `tests/sdp-code.test.js`;
  - the unused lobby texts.

## Deployment

- A `deploy-worker` job in `.github/workflows/pages.yml` runs after the checks. It applies the D1 migrations and deploys the Worker. The Pages deploy waits for it.
- One-time setup by the user:
  1. Create a Cloudflare account.
  2. Create the D1 database `school-games`.
  3. Add the GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- The README describes these steps.

## Tests

- `tests/worker/rooms.test.js` runs `createApp` against the real migration SQL on Node's built-in `node:sqlite`, through a small D1-style adapter (`tests/helpers/d1.js`).
- `tests/worker/ice-servers.test.js` checks that `/ice-servers` returns Cloudflare's STUN server.
- `tests/room-code.test.js` covers `parseRoomCode`.
- WebRTC and the lobby are checked with the headless two-browser script, as before. jsdom has no WebRTC.
