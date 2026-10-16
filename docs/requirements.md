# Requirements: Education games platform, "Robot Maze" and "Tug of War"

## Summary

Education games is a static web app (HTML, CSS and ES-module JavaScript with no runtime dependencies or backend) that hosts learning games for young kids. The first game, **Robot Maze**, practises the 10×10 multiplication table. The child walks through a 10×10 maze. Ten robots block the path to the exit, and each robot is disabled by typing the product of its cell's coordinates. A wrong answer costs 5 seconds. A faster time is a better result. Players get generated nicknames such as `RedFox1`. Their results and statistics are stored in the browser, and after a game a player can add the score to an online leaderboard. The UI is in Polish and English. The platform has a plug-in contract so more games can be added later. Two-player games connect two browsers directly over WebRTC. A small Cloudflare Worker only passes the connection details between them through a short room code (shown as a link and a QR code). The second game, **Tug of War**, is such a duel: both players get the same multiplication, and the faster correct answer tugs the rope. Sources: [plan.md](plan.md), [plan-tug-of-war.md](plan-tug-of-war.md), [plan-pvp-rooms.md](plan-pvp-rooms.md), [plan-leaderboard.md](plan-leaderboard.md).

## R1 – Platform

- R1.1 The app is static files only, with one exception: the small Cloudflare Worker in `worker/` (free tier, R6), which accepts requests only from the app's own origins. Nothing is fetched from a CDN or installed from npm at runtime. Third-party code is allowed only as a vendored, licence-compatible file under `src/vendor/` with its source and licence noted in a header. It must be served over HTTP(S) because it uses ES modules.
- R1.2 Hash routing: `#/` home (list of games), `#/players` (profiles), `#/leaderboard` (R8), `#/game/<id>` (a game) and `#/game/<id>/<arg>`, where `<arg>` is the rest of the hash, passed to the game.
- R1.3 A game is a module that registers a `GameDefinition` (`id`, `titleKey`, `icon`, `messages: {pl, en}`, `mount(root, ctx) → unmount`). The `GameContext` passed to `mount` provides `player` (`{name, account}`), `t`, `recordRun(result)`, `exit()` and `arg` (the route's `<arg>`, or `null`). Adding a game means adding a folder under `src/games/` and one registration line.
- R1.4 The on-screen number pad and direction pad are reusable core UI components.
- R1.5 Logging goes through a small logger. Debug output is enabled with `?debug=1`.
- R1.6 Only the page served from `boryszef.github.io` talks to the production Worker. A page served from any other host (`localhost`, `127.0.0.1`, the computer's Wi-Fi address) talks to `http://<that host>:8787`, the local Worker with its local database. The production Worker accepts only the `https://boryszef.github.io` origin. The local Worker also accepts the origins listed in `DEV_ORIGINS`, which `npm run dev` sets and the deployed Worker never has.

## R2 – Internationalisation

- R2.1 Supported languages are Polish (default) and English. A switcher in the header changes the language, and the choice persists.
- R2.2 Core and per-game dictionaries must define the same set of keys in each language.

## R3 – Players and persistence

- R3.1 A browser keeps exactly one player. It is created once with the **New player** button and gets a nickname from the Worker (R8.1). There is no name input, and once the player exists the button is gone, so there is no adding or switching players. Creating the player needs internet; if the Worker can't be reached, "Can't reach the game server" is shown and the button can be pressed again. A game can only be started once the player exists. If a game link is opened before that, the app asks to create the player and then returns to that link.
- R3.2 All state lives in `localStorage` under a single key `schoolGames` as `{version: 2, data}`.
- R3.3 `data` holds `lang`, `player` (`null` until it is created) and `runs`. The player is `{name, createdAt, account?}`, where `name` is the nickname and `account` is `{id, token}` from the Worker. A run is `{gameId, finishedAt, timeMs, penaltyMs, mistakes}`, where `timeMs` includes the penalties and `mistakes` is a list of `[row, col]` pairs.
- R3.4 The best time per game is the minimum `timeMs` of the player's runs in that game.
- R3.5 The most-missed products per game are the `[row, col]` pairs from the `mistakes` of the player's runs in that game, ranked by count (most frequent first). They are only displayed and don't affect gameplay.
- R3.6 Version 1 data, which could hold several players, is migrated when loaded: the selected player (or, with none selected, the first one) and their runs are kept, and the other players and their runs are dropped. Data with any other unknown `version` is an error. It is not silently discarded.

## R4 – Robot Maze rules

- R4.1 The maze is a 10×10 perfect maze (every cell is reachable and there are no loops), freshly generated for every game. Rows and columns are numbered 1–10, and the numbers are shown along the top and left edges.
- R4.2 The start is at (1,1) and the exit at (10,10).
- R4.3 Exactly 10 robots are placed on distinct cells of the start→exit path, never on the start or the exit cell.
- R4.4 The player moves one cell at a time with the arrow keys or WASD, the on-screen d-pad, or by tapping an adjacent cell. Moves through walls are ignored.
- R4.5 Moving into a cell with an active robot doesn't move the player. Instead it opens a challenge "row × col = ?".
- R4.6 A correct answer disables the robot and moves the player into its cell. From then on the board shows the robot's product (e.g. `56`) in that cell instead of the robot, except while the player stands there.
- R4.7 A wrong answer adds a 5000 ms penalty, records the `[row, col]` mistake and keeps the challenge open for a retry. The UI shows "try again" feedback.
- R4.8 Answers are typed on the keyboard (`inputmode="numeric"`) or with the on-screen number pad.
- R4.9 The timer starts when the maze appears and stops when the player reaches the exit. The displayed time includes penalties.
- R4.10 The result screen shows the total time, the number of mistakes and whether it is a new personal best. It offers "Play again" and "Home".
- R4.11 **Robot Maze – hard** is a separate game (`robot-maze-hard`, its own home tile, stats and rankings) with the same rules on a 20×20 maze with 20 robots. Rows and columns are numbered 1–20, so the questions go up to 20 × 20 = 400. R4.1–R4.3 describe the standard level; the hard level only changes the size and the number of robots.

## R5 – Quality

- R5.1 The pure logic (maze, path, robots, game state, profiles, storage, i18n parity, room codes, nicknames, the Worker's rooms, players, maze runs, duels and leaderboard, Tug of War rules and message validation) is unit-tested with `node --test`.
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
- R6.7 Messages between the peers are JSON and are validated on receipt. An invalid message is an error. `hello` carries the protocol version (currently 2). If the other device sends a different version or none, both players see "You and your friend have different versions of the game – reload the page on both devices" with "Choose another game", and the connection is closed.
- R6.8 When the connection drops during a match, both players see "connection lost" and can go home. When it drops after a match has ended, the result and the leaderboard prompt stay. "Play again" (or the guest's waiting line) is replaced by "Your friend has left."

## R7 – Tug of War rules

- R7.1 Two players on two devices, connected as in R6. The host's game is authoritative.
- R7.2 Both players get the same question a × b with a and b in 2–10. A question never repeats the one right before it.
- R7.3 Each player's reaction time is measured on their own device from when the question appeared. The host waits up to 300 ms after the first correct answer (or until both have answered) and then gives the round to the faster reaction time. On equal times the answer recorded first wins.
- R7.4 The winner of a round tugs the rope one step towards their side. The first player to pull the rope 5 steps to their side wins the match.
- R7.5 A correct answer clears the question and the typed answer at once, and only "Correct!" stays until the next question. A wrong answer shakes the card and freezes that player for 2 s, after which they can answer again. The freeze counts towards their reaction time.
- R7.6 After a tug there is a short pause (about 1.2 s) for the animation, then the next question.
- R7.7 Answers are typed on the keyboard or with the on-screen number pad.
- R7.8 Both players' names are shown at the ends of the rope. The result screen shows the winner and offers "Play again" (started by the host; the guest waits) and "Home".
- R7.9 Matches are not saved to the player's stats. A win can be added to the leaderboard as in R8.5.

## R8 – Leaderboard

- R8.1 **Nicknames.** `POST /players` creates a player with a nickname `<Color><Animal><N>`, such as `RedFox1`. The Worker picks the color and animal at random from fixed English lists (`src/core/online/nickname.js`). `N` is the next free number for that color and animal, so nicknames are unique. The response also gives a public id and a secret token. Creating players is limited to 10 a minute per IP.
- R8.2 **Existing players.** At app start, a player without an account is registered and renamed to its new nickname. Runs and stats stay. If the Worker can't be reached, this is tried again at the next start, and until then the player can't add scores.
- R8.3 **Prompt.** When a game ends, a player with an account is asked "Add your score to the leaderboard?" with **Yes** and **No**. Nothing is sent without **Yes**.
- R8.4 **Robot Maze times.**
  - With an account, a round starts with `POST /maze-runs` and the body `{level}`, where `level` is `standard` or `hard`. It returns a run id and the maze seed, and the server notes the start time. The maze is built from that seed, and the player's moves and answers are recorded.
  - On **Yes**, they are sent to `POST /maze-runs/:id/finish`. The Worker replays them with the game's own rules for the run's level, and the run counts only if the replay reaches the exit. The leaderboard time is the server's elapsed time plus 5 s per wrong answer, and the result card shows it.
  - Each run can be finished once, within 1 hour, and only by its own player. At most 2000 actions are accepted on the standard level and 8000 on the hard one.
  - If the Worker can't be reached at the start, the round is played locally and no prompt is shown.
- R8.5 **Tug of War wins.**
  - Both players are asked. On **Yes**, each sends `{matchId, opponentId, won}`.
  - A win counts only when both reports for a match agree: each names the other, and exactly one won. Reports that disagree are discarded.
  - At most 3 wins per winner and opponent count per UTC day.
  - The prompt appears only when both players have an account.
- R8.6 **Rankings.** `#/leaderboard`, linked from the header (🏆) on every screen, shows, for each game, the top 10 all-time and the top 10 this week (since Monday 00:00 UTC):
  - Robot Maze and Robot Maze – hard, each with its own lists: each player's best time, fastest first.
  - Tug of War: number of wins, most first.
  - The current player's row is highlighted.
  - The list is never cached, so a score shows as soon as it has been added.
- R8.7 **Privacy.** No real names are stored: nicknames are generated. The Worker stores no IP addresses, and keeps only a hash of each token. The token is sent only to the Worker and never to the other player; the other player sees only the public id.
