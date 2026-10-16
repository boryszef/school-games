# Requirements: Education games platform, "Robot Maze" and "Tug of War"

## Summary

Education games is a static web app (HTML, CSS and ES-module JavaScript with no runtime dependencies or backend) that hosts learning games for young kids. The first game, **Robot Maze**, practises the 10×10 multiplication table. The child walks through a 10×10 maze. Ten robots block the path to the exit, and each robot is disabled by typing the product of its cell's coordinates. A wrong answer costs 5 seconds. A faster time is a better result. Player profiles, results and statistics are stored only in the browser. The UI is in Polish and English. The platform has a plug-in contract so more games can be added later. Two-player games connect two browsers directly over WebRTC. A small Cloudflare Worker only passes the connection details between them through a short room code (shown as a link and a QR code). The second game, **Tug of War**, is such a duel: both players get the same multiplication, and the faster correct answer tugs the rope. Sources: [plan.md](plan.md), [plan-tug-of-war.md](plan-tug-of-war.md), [plan-pvp-rooms.md](plan-pvp-rooms.md).

## R1 – Platform

- R1.1 The app is static files only, with one exception: the small Cloudflare Worker in `worker/` (free tier, R6), which accepts requests only from the app's own origins. Nothing is fetched from a CDN or installed from npm at runtime. Third-party code is allowed only as a vendored, licence-compatible file under `src/vendor/` with its source and licence noted in a header. It must be served over HTTP(S) because it uses ES modules.
- R1.2 Hash routing: `#/` home (list of games), `#/players` (profiles), `#/game/<id>` (a game) and `#/game/<id>/<arg>`, where `<arg>` is the rest of the hash, passed to the game.
- R1.3 A game is a module that registers a `GameDefinition` (`id`, `titleKey`, `icon`, `messages: {pl, en}`, `mount(root, ctx) → unmount`). The `GameContext` passed to `mount` provides `player`, `t`, `recordRun(result)`, `exit()` and `arg` (the route's `<arg>`, or `null`). Adding a game means adding a folder under `src/games/` and one registration line.
- R1.4 The on-screen number pad and direction pad are reusable core UI components.
- R1.5 Logging goes through a small logger. Debug output is enabled with `?debug=1`.

## R2 – Internationalisation

- R2.1 Supported languages are Polish (default) and English. A switcher in the header changes the language, and the choice persists.
- R2.2 Core and per-game dictionaries must define the same set of keys in each language.

## R3 – Players and persistence

- R3.1 A player can be created by name and selected. A game can only be started with a selected player. If a game link is opened without one, the app asks for a player and then returns to that link.
- R3.2 All state lives in `localStorage` under a single key `schoolGames` as `{version: 1, data}`.
- R3.3 `data` holds `lang`, `currentPlayerId`, `players` and `runs`. A run is `{playerId, gameId, finishedAt, timeMs, penaltyMs, mistakes}`, where `timeMs` includes the penalties and `mistakes` is a list of `[row, col]` pairs.
- R3.4 The best time per player and game is the minimum `timeMs` of their runs.
- R3.5 The most-missed products per player and game are the `[row, col]` pairs from their runs' `mistakes`, ranked by count (most frequent first). They are only displayed and don't affect gameplay.
- R3.6 Data with an unknown `version` is an error. It is not silently discarded.

## R4 – Robot Maze rules

- R4.1 The maze is a 10×10 perfect maze (every cell is reachable and there are no loops), freshly generated for every game. Rows and columns are numbered 1–10, and the numbers are shown along the top and left edges.
- R4.2 The start is at (1,1) and the exit at (10,10).
- R4.3 Exactly 10 robots are placed on distinct cells of the start→exit path, never on the start or the exit cell.
- R4.4 The player moves one cell at a time with the arrow keys or WASD, the on-screen d-pad, or by tapping an adjacent cell. Moves through walls are ignored.
- R4.5 Moving into a cell with an active robot doesn't move the player. Instead it opens a challenge "row × col = ?".
- R4.6 A correct answer disables the robot and moves the player into its cell.
- R4.7 A wrong answer adds a 5000 ms penalty, records the `[row, col]` mistake and keeps the challenge open for a retry. The UI shows "try again" feedback.
- R4.8 Answers are typed on the keyboard (`inputmode="numeric"`) or with the on-screen number pad.
- R4.9 The timer starts on the first move and stops when the player reaches the exit. The displayed time includes penalties.
- R4.10 The result screen shows the total time, the number of mistakes and whether it is a new personal best. It offers "Play again" and "Home".

## R5 – Quality

- R5.1 The pure logic (maze, path, robots, game state, profiles, storage, i18n parity, room codes, the Worker's room logic, Tug of War rules and message validation) is unit-tested with `node --test`.
- R5.2 Pre-commit hooks run Prettier, ESLint, `tsc --checkJs` (JSDoc types), knip (dead code) and the tests.
- R5.3 The Node version is managed through nvm (`.nvmrc`).

## R6 – Peer-to-peer (two-player games)

- R6.1 Two browsers connect directly over a WebRTC data channel. The Worker only passes the offer and answer between them (R6.2–R6.4) and gives the ICE servers from `GET /ice-servers`: Cloudflare's free STUN server. There is no TURN relay, because Cloudflare TURN can only be activated with a payment card. Some strict networks therefore cannot connect, and the UI then shows a "could not connect" message.
- R6.2 The host posts its offer and gets a room code: 6 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`. The host's screen shows the code in large letters, a QR code and the link `#/game/<id>/join/<code>` with a copy button. It also shows a "Have a code?" box that takes a code or a whole link (ignoring case and spaces) and joins that room as the guest.
- R6.3 The guest fetches the offer, posts the answer and then waits with no time limit. The host asks for the answer every 1.5 s. Once it has the answer, it waits up to 60 s for the connection and shows a countdown meanwhile.
- R6.4 Rooms on the Worker:
  - A room expires 10 minutes after creation.
  - A room is deleted as soon as the host has collected the answer, since the offer and answer contain IP addresses.
  - A room accepts one answer only.
  - The offer and answer are SDP texts of at most 8192 characters.
  - Expired rooms are deleted whenever a new room is created.
  - Creating rooms is rate-limited per IP with Cloudflare's rate limiting. No IP addresses are stored.
- R6.5 What the players see when something goes wrong:
  - The host's room expires before an answer arrives: "This invitation has expired", with "New invitation" and "Back to games".
  - The guest opens an unknown, expired or already answered room: "This invitation is no longer valid", with "Back to games".
  - The Worker can't be reached or returns an unexpected error: "Can't reach the game server", with "Try again" and "Back to games".
  - The 60 s connection time runs out: the timeout message, with "Try again with a new invitation" and "Back to games".
  - The browser gives up on the connection: "Could not connect", with "Back to games".
- R6.6 ICE candidates are gathered in full before the offer or answer is sent (non-trickle, capped at 3 s).
- R6.7 Messages between the peers are JSON and are validated on receipt. An invalid message is an error.
- R6.8 When the connection drops, both players see "connection lost" and can go home.

## R7 – Tug of War rules

- R7.1 Two players on two devices, connected as in R6. The host's game is authoritative.
- R7.2 Both players get the same question a × b with a and b in 2–10. A question never repeats the one right before it.
- R7.3 Each player's reaction time is measured on their own device from when the question appeared. The host waits up to 300 ms after the first correct answer (or until both have answered) and then gives the round to the faster reaction time. On equal times the answer recorded first wins.
- R7.4 The winner of a round tugs the rope one step towards their side. The first player to pull the rope 5 steps to their side wins the match.
- R7.5 A wrong answer shakes the card and freezes that player for 2 s, after which they can answer again. The freeze counts towards their reaction time.
- R7.6 After a tug there is a short pause (about 1.2 s) for the animation, then the next question.
- R7.7 Answers are typed on the keyboard or with the on-screen number pad.
- R7.8 Both players' names are shown at the ends of the rope. The result screen shows the winner and offers "Play again" (started by the host; the guest waits) and "Home".
- R7.9 Matches are not saved to the player's stats.
