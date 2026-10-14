# Plan: Peer-to-peer infrastructure + "Tug of War" PvP game

## Summary

Add serverless two-player support: the host's browser makes a WebRTC offer and shares it as a link + QR code; the guest opens it and returns an answer link/QR; the host's tab receives it (via BroadcastChannel from a new tab, or a paste box) and the two browsers talk directly over a WebRTC data channel. No server of ours, no runtime npm deps; one vendored MIT file (Nayuki's QR encoder). On top of that, a new game **Tug of War**: both players get the same multiplication (2–10 × 2–10), the faster correct answer tugs the rope one step, first to pull the rope 5 steps to their side wins. Wrong answer = 2 s freeze. Host is authoritative; fairness uses each player's locally measured reaction time.

## Context

The app is static (GitHub Pages), state only in `localStorage`. The user wants PvP without any central server. Decisions taken with the user:

| Topic         | Decision                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Signaling     | Manual two-way exchange (offer link/QR → answer link/QR), no third-party services except a public STUN server |
| Answer return | Answer link opened on the host's device → BroadcastChannel to the waiting tab; plus a paste box               |
| QR encoder    | Vendor Nayuki `qrcodegen` (MIT) into `src/vendor/`                                                            |
| Win rule      | Rope position, ±5 wins                                                                                        |
| Wrong answer  | ~2 s freeze, then retry                                                                                       |
| Questions     | 2–10 × 2–10, never the same as the previous one                                                               |
| Stats         | Matches are not saved (for now)                                                                               |
| Setting       | Both same-room (QR) and remote (link)                                                                         |

Workflow (project rules): plan → requirements in `docs/` → failing tests for user review → implementation.

## Connection flow

```
Host tab                                   Guest device
1. hostPeer(): create offer, wait for ICE
   gathering (cap 3 s), encode → code
2. show QR + link  #/game/tug-of-war/join/<offer>  ──scan/click──►  3. joinPeer(offer): answer, encode
                                                                     4. show QR + link
                                    ◄──scan with camera / messenger──  #/game/tug-of-war/answer/<answer>
5a. new tab opens answer link → BroadcastChannel → host tab (ack → "go back to the game tab")
5b. or paste link/code into the host's paste box
6. host setRemoteDescription(answer) → data channel opens on both sides → lobby resolves → match
```

- STUN: `stun:stun.l.google.com:19302`. Same Wi-Fi works through host/mDNS candidates; strict networks (symmetric NAT) may fail. There's no TURN, by design: show a "could not connect" message after a timeout.
- Non-trickle ICE: the full candidate list goes into one code.
- Data channel is `negotiated: true, id: 0` so the SDP only needs the transport.
- The offer carries a random `sessionId`, and the answer echoes it, so the answer reaches the right host tab.
- The invite only works while the host tab stays open. The UI says so.

## New files

### Network infrastructure (reusable by future PvP games)

- `src/core/net/sdp-code.js`: **pure**. `encodeDescription({type, sdp, sessionId}) → string` and `decodeDescription(code) → {type, sdp, sessionId}`. It keeps only ice-ufrag, ice-pwd, the DTLS fingerprint, the setup role and the candidates (address, port, type), packed into a short base64url string, and rebuilds a minimal `m=application … webrtc-datachannel` SDP when decoding. Malformed codes throw a specific error, which the UI shows as "invalid code". The aim is to keep the link short enough for a readable QR code.
- `src/core/net/peer.js`: `hostPeer()` → `{offerCode, accept(answerCode) → Promise<Channel>}` and `joinPeer(offerCode)` → `{answerCode, channel: Promise<Channel>}`. `Channel` = `{send(msg), onMessage(fn), onClose(fn), close()}` with JSON messages. Debug logging covers SDP/code sizes, candidate counts and state changes.
- `src/core/net/answer-relay.js`: `listenForAnswer(sessionId, onCode)` (host tab, sends an ack) and `deliverAnswer(code) → Promise<boolean>` (answer tab, true if a host acked within 1 s). Uses BroadcastChannel.
- `src/vendor/qrcodegen.js` + `qrcodegen.d.ts`: Nayuki QR-Code-Generator (MIT), compiled once from the upstream TS at a pinned commit. A header notes the source, commit and licence. Excluded from ESLint, Prettier and knip; the `.d.ts` keeps `tsc` happy.
- `src/core/ui/qr.js`: `createQrCode(text) → SVGElement` (ECC level L, quiet zone).
- `src/core/ui/pvp-lobby.js`: generic connect UI. `openLobby(root, {gameId, arg, t}) → Promise<{role: "host" | "guest", channel}>`. Its views:
  - **Host**: invite QR, link with a copy button, "keep this tab open", answer paste box, waiting state.
  - **Guest** (`arg` = `join/<code>`): answer QR, link with a copy button, "show this to the host", then connecting.
  - **Answer tab** (`arg` = `answer/<code>`): "Answer delivered, go back to the game tab" or "No waiting game in this browser, paste the link there".
  - Connection failure or timeout: a message and a Home button.

### Platform changes

- `src/core/router.js`: `#/game/<id>/<arg>` becomes `{name: "game", id, arg}`, where `arg` is the rest of the hash; it is `null` without one.
- `src/core/registry.js` / `src/screens/game.js`: add `arg: string | null` to `GameContext`.
- Guest without a selected player: `screens/game.js` saves the requested hash before redirecting to `#/players`, and `screens/players.js` goes back to it after a player is chosen or added, so the invite isn't lost. This needs a small field on `App` in `src/core/app.js`.
- `src/main.js`: `registerGame(tugOfWar)`.

### Game: `src/games/tug-of-war/`

- `match.js`: **pure** host-side rules.
  - `createMatch(rng)` → `{rope: 0, round: 1, question: {a, b}, answers: {}, winner: null}`
  - `recordAnswer(state, side, round, reactionMs)`: ignores stale rounds and a side that already answered.
  - `resolveRound(state, rng)`: the fastest `reactionMs` wins the round, and a tie goes to the first recorded. The rope moves ±1 (host = −1, guest = +1). At |rope| = 5 a winner is set, otherwise a new question and `round + 1`.
  - `nextQuestion(previous, rng)`: 2–10 × 2–10, never the same as the previous question.
  - Constants: `ROPE_TO_WIN = 5`, `GRACE_MS = 300`.
- `protocol.js`: message types and **validation of incoming messages** (external input):
  - host → guest: `hello {name}`, `question {round, a, b}`, `tug {round, winner, rope}`, `end {winner}`
  - guest → host: `hello {name}`, `answer {round, value, reactionMs}`
  - `parseMessage(raw)` throws on unknown or invalid messages.
- `session.js`: host and guest controllers.
  - The host runs `match.js`. On the first correct answer it waits up to `GRACE_MS` (or until both have answered), then resolves the round. This way the guest isn't penalised by network latency.
  - The host checks the guest's `value === a*b`.
  - Each side measures `reactionMs` from when _its own_ screen showed the question.
  - A wrong answer is checked locally and freezes that player for `FREEZE_MS = 2000`. The freeze counts toward reaction time.
  - After a tug: pause `TUG_PAUSE_MS ≈ 1200` for the animation, then the next question.
- `rope.js`: rope/flag UI, names on both ends, and the tug animation.
- `question.js`: question card with input + `createNumpad` (`src/core/ui/numpad.js`), shake on a wrong answer, and a freeze overlay with a countdown.
- `result.js`: "You won!" or "{name} won", "Play again" (the host starts a new match, and the guest sees "waiting for the host"), Home.
- `index.js`: the `GameDefinition` (`id: "tug-of-war"`, icon 🪢, which may need adding to the emoji font subset). `mount` → `openLobby` → session.
- `i18n.js` (pl + en) and `style.css` (prefix `tw-`).

Possible follow-up, not part of this change: `question.js` will look a lot like `robot-maze/challenge.js` (input + numpad + shake). A shared answer component in `src/core/ui/` could serve both later.

## Docs

- `docs/requirements.md`:
  - R1.1: allow vendored, licence-compatible files; nothing is fetched or installed at runtime.
  - R1.2: the `#/game/<id>/<arg>` route.
  - R1.3: `ctx.arg`.
  - New **R6 – Peer-to-peer** (flow above).
  - New **R7 – Tug of War rules**.
- `README.md`: a game section, a short "How PvP works" note, and the vendored QR file under the licence section.

## Tests (written first, for user review)

- `tests/sdp-code.test.js`: round trip using real Chrome, Firefox and Safari data-channel SDP fixtures (host, srflx and mDNS candidates), checking that the code stays short and that malformed codes throw.
- `tests/match.test.js`: the faster reaction wins, stale and duplicate answers are ignored, the rope reaches ±5 → winner, questions stay in 2–10 and don't repeat, and a lone answer resolves the round.
- `tests/protocol.test.js`: valid messages parse, and wrong types or fields throw.
- `tests/router.test.js`: `#/game/x/join/abc` gives `arg: "join/abc"`, and `arg` is `null` without one.
- `tests/i18n.test.js`: pl/en parity for tug-of-war.
- jsdom: `question.js` (freeze blocks input, shake) and `qr.js` (renders an SVG with modules).
- Not unit-tested: `peer.js` and `answer-relay.js`, because jsdom has no RTCPeerConnection. They are covered by the manual checks below.

## Verification

1. `npm test`, `npm run lint`, `npm run typecheck`, `npm run deadcode` and `npm run format:check` all pass.
2. `npm run serve`, then Chrome and Firefox windows on one machine. Host → copy link → guest window → copy the answer link → open it in a new tab of the host browser, which triggers the BroadcastChannel path. Then check the paste-box path too. Play a full match and a rematch.
3. Phone and laptop on the same Wi-Fi (serve on the LAN IP). Laptop hosts: the phone camera app scans the invite QR, and the answer goes back through the paste box. Two phones: each camera app scans the other's QR, so the answer arrives through the BroadcastChannel path. Try it in both directions. Note: the Clipboard API needs HTTPS, so on plain-http LAN the copy button must fall back to selecting the text.
4. After deploying to GitHub Pages: a phone on mobile data against a laptop on home Wi-Fi (the NAT traversal case), plus Safari on iOS.
5. Close the guest tab mid-match: the host sees "connection lost".
