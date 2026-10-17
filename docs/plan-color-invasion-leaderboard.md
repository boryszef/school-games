# Plan: Color Invasion on the leaderboard

## Summary

Color Invasion scores go to the online leaderboard, with one ranking per target language (English, Deutsch, Español). Each ranking has a top 10 all-time and a top 10 this week, made from each player's best round score (highest first; on a tie, whoever got it first). Scores are checked the way Robot Maze times are:

- A round starts with `POST /color-runs {lang}`, which returns a run id and a seed. The seed sets the column order and every target color.
- The game records the player's moves and shots and sends them to `POST /color-runs/:id/finish`.
- The Worker replays them with the game's own rules to get the score. It accepts the finish only within 60 s + 10 s of the start.
- Without an account, or when the Worker can't be reached, the round is played locally and nothing is sent.

## Context

Color Invasion (on the `color-invasion` branch, not yet merged) shows the score only on its result card (R9.10). The user now wants it on the leaderboard. Decisions made with the user:

| Topic    | Decision                                                                  |
| -------- | ------------------------------------------------------------------------- |
| Rankings | One per language: three sections, each with all-time and this-week top 10 |
| Trust    | Server seed + replay, like Robot Maze (R8.4)                              |
| Order    | Each player's best round score, highest first; tie → earlier round        |

Work continues on the `color-invasion` branch, because the game isn't on `master` yet. Workflow (project rules): plan → requirements in `docs/` → failing tests for review → implementation.

## Worker

- **`worker/migrations/0004_color_runs.sql`**: table `color_runs (id TEXT PK, player_id REFERENCES players, seed INTEGER, lang TEXT, started_at INTEGER, score INTEGER, finished_at INTEGER)` and index `(lang, finished_at)`.
- **`worker/src/color-runs.js`**: `createColorRuns({db, now, randomBytes})` → `{start(playerId, body), finish(playerId, runId, body)}`, following `worker/src/maze-runs.js`.
  - `start`:
    - Body is exactly `{lang}`, where `lang` is a key of `TARGET_LANGUAGES` (`src/games/color-invasion/colors.js`); otherwise 400.
    - Deletes unfinished runs older than 1 h (same housekeeping as maze runs).
    - Returns 201 `{runId, seed}`.
  - `finish`:
    - Body is exactly `{actions}`, at most 1000 actions. An action is `"left" | "right" | "shoot" | {to: n}` with an integer column `0 ≤ n < 10`. Otherwise 400.
    - Unknown run or another player's run: 404. Already finished: 409.
    - Arriving later than `started_at + ROUND_MS + 10 s`: 422 (the round is over).
    - Otherwise it replays the actions with `createRound` / `moveShip` / `moveShipTo` / `shoot` from `src/games/color-invasion/state.js`, using one `createRng(seed)` stream. It stores the score and returns 200 `{score}`.
- **`worker/src/app.js`**: two routes (`POST /color-runs`, `POST /color-runs/:id/finish`), both `player: true`.
- **`worker/src/leaderboard.js`**: `colorTop(lang, since)` is the same query shape as `mazeTop`, but takes `MAX`/highest score per player (ROW_NUMBER over `score DESC, finished_at`) and orders by `score DESC, finished_at`. The response gains `colors: {en, de, es}`, each `{allTime, week}` of `{nickname, score}`.

## App

- **`src/games/color-invasion/online.js`** (new):
  - `startServerRun(account, lang)` → `{runId, seed, token} | null`. It returns null without an account or on `ServerUnreachableError` / `ApiError`, like `_serverRun` in `src/games/robot-maze/index.js`.
  - `submitRun(t, run, actions)` uses `submitToLeaderboard` from `src/core/ui/leaderboard-submit.js`.
- **`src/games/color-invasion/index.js`**:
  - After the language is picked, it shows "Preparing…" until the run starts.
  - Randomness comes from `createRng(run.seed)` (or `Math.random` offline) for both `createRound` and `shoot`.
  - Every command (`"left" | "right" | "shoot" | {to}`) is pushed to `actions`.
  - At the end the result card gets the leaderboard status element (null offline), the same way robot-maze's `createResultPanel` does.
- **`src/games/color-invasion/result.js`**: an optional `submission` element, as in robot-maze's `result.js`.
- **`src/games/color-invasion/i18n.js`**: `colorInvasion.preparing`.
- **`src/screens/leaderboard.js`**: three sections titled `👾 Color Invasion – English/Deutsch/Español`, with the value column "Points" (new core key `leaderboard.points` in `src/i18n/pl.js` / `en.js`). The `Leaderboard` typedef gains `colors`.

## Docs

- `docs/requirements.md`:
  - New R8.6 **Color Invasion scores**, covering the start, finish, replay, 70 s deadline, 1000-action cap and offline play.
  - R8.7 (was R8.6): three per-language rankings by best score.
  - R9.10: scores are sent (replacing "not sent").
- `docs/plan-color-invasion-leaderboard.md`: this plan.

## Tests (written first, for review)

- **`tests/worker/color-runs.test.js`**, using `workerSetup` from `tests/helpers/worker.js`. A small helper builds honest actions from the seed: it replays `createRound(createRng(seed))` and moves to the target's column before each shot.
  - A new run has an id and a 32-bit seed.
  - An honest replay returns the expected score, misses and bonus included.
  - Missing, unknown or extra `lang`, malformed actions, a bad column and more than 1000 actions get 400.
  - Finishing after 70 s gets 422.
  - Finishing twice gets 409.
  - Another player's token gets 404.
- **`tests/worker/leaderboard.test.js`**:
  - Color scores are ranked per language.
  - The best round per player counts, highest first, and a tie goes to the earlier round.
  - The weekly list starts on Monday UTC.

## Verification

1. `npm test`, lint, typecheck, deadcode, format:check.
2. `npm run dev` (local Worker + D1; check that the user's own dev server isn't already on the ports):
   - Play a round in each language.
   - The result card shows "Sending…" and then "Added!".
   - `#/leaderboard` shows the three new sections with the score.
   - With the Worker stopped, the round still plays and nothing is sent.
3. The production deploy applies migration 0004 through the existing CI job once the branch is merged to `master`.

## Follow-ups (flag, not in scope)

- `startServerRun` duplicates robot-maze's `_serverRun` pattern. A shared core helper could replace both later.
- `hide-hard-maze` also edits `src/screens/leaderboard.js`, so expect a small merge conflict.
