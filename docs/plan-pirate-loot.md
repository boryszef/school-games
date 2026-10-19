# Plan: "Pirate Loot" – division practice

## Summary

A new single-player game, **Pirate Loot / Skarb piratów** (`pirate-loot`, icon 🏴‍☠️), for memorizing divisions with whole-number answers up to 100. The player is a pirate captain. Each trip:

1. A random crew of 2–10 pirates comes aboard (the captain counts as one of them).
2. The ship sails to an island and finds a chest with crew × share coins, where the share is 1–10.
3. The captain types how many coins each pirate gets, before the crew runs out of patience.
4. A right answer adds the captain's share to the loot. Then the player either sails again or retires with the loot.
5. A wrong or late answer gets the captain thrown overboard, and the loot is lost.

The crew's patience gets shorter every trip: 15 s on the first one, 1 s less each trip after that, down to 4 s. Retiring sends the loot to the leaderboard. The Worker checks it by replaying the game from its own seed, the same way as Color Invasion scores.

## Context

The user wanted a division game where the division comes from the game itself. Sharing loot fairly between pirates is division by its nature. The push-your-luck choice (sail again or retire) adds the tension. Decisions made with the user:

| Topic    | Decision                                                                                  |
| -------- | ----------------------------------------------------------------------------------------- |
| Facts    | Crew 2–10 (captain included), share 1–10: the 10×10 table backwards, always splits evenly |
| Mistake  | The first wrong answer ends the game and the loot is lost                                 |
| Score    | The captain's own loot when retiring: the sum of their shares                             |
| Risk     | Impatient crew: less time to answer every trip; too slow counts as a wrong answer         |
| Graphics | HTML, CSS and inline SVG with CSS animations, no canvas (R1.7 on `canvas-last-resort`)    |

Defaults chosen in the plan (constants, easy to tune): 15 s on trip 1, −1 s per trip, 4 s minimum. The same crew and treasure never come twice in a row.

Workflow (project rules): plan → requirements in `docs/` → failing tests for review → implementation.

## Files

### New: `src/games/pirate-loot/`

- **`state.js`**: pure, immutable rules. Randomness comes from an injected `Rng` (`src/core/random.js`), as in `src/games/color-invasion/state.js`.
  - `createGame(rng)` → `{trip: 1, crew, treasure, loot: 0, status: "splitting"}`.
  - `answerLimitMs(trip)`: 15 000 ms minus 1 000 ms per earlier trip, at least 4 000 ms.
  - `split(state, answer, elapsedMs)`: a right answer in time adds `treasure / crew` to the loot and sets `status: "choosing"`. A wrong answer, no answer (`null`) or a late one sets `status: "overboard"`.
  - `sailAgain(state, rng)`: the next trip with a new crew and treasure, never the same pair as the trip before.
  - `retire(state)`: `status: "retired"`.
- **`pirates.js`**: a few inline-SVG pirate parts (hats, bandanas, eyepatch, parrot, hook), combined at random so each crew looks different.
- **`scene.js`**: the DOM/SVG view of the ship, crew, chest, coin piles, plank and splash, with CSS animations for coming aboard, sailing, opening the chest, dealing coins, cheering and walking the plank. The state changes at once; the animations are only visual. The pirates, the plank and the walk are sized from the ship's width (container query units), so up to 10 pirates fit on a 360 px screen.
- **`panel.js`**: under the scene, the question with the answer field, the patience fuse and the number pad (`createNumpad`, `src/core/ui/numpad.js`); after a won trip, the choice between sailing again and retiring.
- **`index.js`**: the `GameDefinition`. It runs the trips and the patience timer (`createTimer`, `src/core/timer.js`), records the actions, sends a retired captain's game to the Worker and shows the result. A game that ends overboard isn't sent: it has no score, and "Added!" for it would be misleading.
- **`result.js`**: the result card (`createOverlayCard`, `src/core/ui/overlay.js`). It shows either "retired with X 🪙" or "thrown overboard" with the right division (`42 ÷ 6 = 7`). It also shows the number of trips, "Play again" and "Choose another game", and the leaderboard status as in Color Invasion.
- **`i18n.js`**, **`style.css`** (prefix `pl-`, theme tokens from `css/base.css`, reduced motion respected).

### Worker

- **`worker/migrations/0005_pirate_runs.sql`**: table `pirate_runs`, shaped like `color_runs`.
- **`worker/src/runs.js`**: the variant column becomes optional (`null`), because Pirate Loot has one kind of run, with no level or language.
- **`worker/src/pirate-runs.js`**: uses `createRunTable` and `readActions` from `worker/src/runs.js`.
  - `start`: the body is exactly `{}`. Returns 201 `{runId, seed}`.
  - `finish`: the body is `{actions}`, at most 1000 actions. An action is `{answer, ms}` (`answer` is 1–10 or `null` when time ran out, `ms` is a whole number ≥ 0), `"sail"` or `"retire"`.
  - The replay uses `state.js` with `createRng(seed)`. Actions must follow the game: an answer while splitting, then `"sail"` or `"retire"` after a won trip, and nothing after the game has ended. The game must have ended (retired or overboard), otherwise 400.
  - The sum of the `ms` values may not exceed the server's elapsed time, otherwise 422. Finishing more than 1 hour after the start also gets 422.
  - Returns 200 `{score}`: the loot when retired, 0 when overboard.
- **`worker/src/app.js`**: `POST /pirate-runs` and `POST /pirate-runs/:id/finish`, both for players only.
- **`worker/src/leaderboard.js`**: each best-run query names its own filter (`level = ?`, `lang = ?`, `score > 0`) instead of a variant column. The response gains `pirates: {allTime, week}` of `{nickname, score}`. It holds each player's best score above 0, highest first; on a tie, the earlier game first.

### App, changed

- `src/main.js`: `registerGame(pirateLoot)`.
- `src/games/pirate-loot/index.js` uses `startServerRun` / `finishServerRun` (`src/core/online/server-run.js`) and `submitToLeaderboard` (`src/core/ui/leaderboard-submit.js`).
- `src/screens/leaderboard.js`: a Pirate Loot section with a "Gold" column.
- `css/base.css` + `fonts/emoji-subset.woff2`: the emoji used (🏴‍☠️, 🪙, ⛵), enforced by `tests/emoji-font.test.js`.
- `docs/requirements.md`: R11 (rules), R8.7 (scores), R8.8 (rankings), R5.1, R10.2.
- `README.md`: the game's description.

## Tests (written first, for review)

- `tests/pirate-loot-state.test.js`: the crew size and share ranges, a right answer adds the share, a wrong, missing or late answer goes overboard, the time limits, no repeated trip, retiring keeps the loot.
- `tests/worker/pirate-runs.test.js`: an honest replay gives the score; overboard gives 0; actions out of order, unfinished games and malformed actions get 400; claimed times longer than the real game and finishing after 1 hour get 422; 404/409 as for color runs.
- `tests/worker/leaderboard.test.js`: the Pirate Loot ranking (best per player, highest first, ties to the earlier game, zero scores left out).
- `tests/i18n.test.js`: pl/en key parity for the new dictionaries.
- `tests/helpers/pirate-player.js`: plays a game from a seed (right answers, then retire or a wrong answer).

## Verification

1. `npm test`, `npm run lint`, `npm run typecheck`, `npm run deadcode`, `npm run format:check`.
2. `npm run dev`, then open `#/game/pirate-loot` on a computer and on a phone (360 px wide):
   - Play several trips and retire; the leaderboard shows the loot.
   - Lose once with a wrong answer and once by running out of time.
   - Check dark mode and reduced motion.
   - With the Worker stopped, the game still plays and nothing is sent.

## Follow-ups (not in scope)

- Better pirate art, sound effects.
- The browser reports its own answer times; the Worker only checks them against the limits and the real length of the game.
