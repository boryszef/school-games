# Plan: Generated nicknames and an online leaderboard

## Summary

- **Nicknames:** players no longer type a name. A new player gets a nickname `<Color><Animal><N>` (e.g. `RedFox1`) from the Worker. The Worker picks the color and animal at random, and `N` is the next free number for that pair, so every nickname is unique worldwide. Nicknames are English in both languages. Creating a player needs internet; playing doesn't.
- **Existing players** with typed names get a nickname automatically the next time the app starts online. Their runs and stats stay.
- **Leaderboard prompt:** after a game, the player is asked "Add your score to the leaderboard?"
  - **Robot Maze:** the server measures the time. The Worker sends the maze seed when the round starts, then replays the moves when the player says yes. The official time is the server's clock plus 5 s per wrong answer.
  - **Tug of War:** both players are asked. A win counts only when both say yes and their reports agree, at most 3 wins per pair per UTC day.
- **Leaderboard screen** `#/leaderboard`, linked from home: top 10 per game, all-time and this week.
- Everything stays on free tiers: GitHub Pages, a Cloudflare Worker and D1. No payment card is needed.

## Context

- Part 1 (rooms for two-player games, [plan-pvp-rooms.md](plan-pvp-rooms.md)) is live.
- The user asked to replace the name input with generated nicknames (`<color><animal><seq.number>`, e.g. `RedFox1`), and to ask after each game whether to add the score to a leaderboard.

The user's decisions:

| Topic            | Decision                                                            |
| ---------------- | ------------------------------------------------------------------- |
| Nickname number  | Assigned by the Worker when the player is created, unique worldwide |
| Language         | English only                                                        |
| Existing players | Get a generated nickname                                            |
| Tug of War       | Both players are asked; the win counts only if both say yes         |
| Robot Maze times | Measured by the server; the clock starts when the maze is shown     |
| Rankings         | All-time and this week (from Monday 00:00 UTC), top 10              |

## Worker

Migration `0002_leaderboard.sql` adds four tables:

- `players(id, token_hash, color, animal, number, created_at)`, unique on `(color, animal, number)`;
- `maze_runs(id, player_id, seed, started_at, time_ms, penalty_ms, finished_at)`;
- `duel_reports(match_id, reporter_id, opponent_id, won, created_at)`, with the primary key `(match_id, reporter_id)`;
- `duel_wins(match_id, winner_id, loser_id, won_at)`.

| Method and path                                   | Result                                                                                                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /players`                                   | 201 `{id, token, nickname}`. Rate-limited per IP to 10 a minute.                                                                                                                              |
| `POST /maze-runs` (auth)                          | 201 `{runId, seed}`.                                                                                                                                                                          |
| `POST /maze-runs/:id/finish` (auth) `{actions}`   | 200 `{timeMs, penaltyMs}`. 422 if the replay doesn't reach the exit, 409 if the run was already finished, 404 if the run is unknown, another player's or older than 1 h, 400 for bad actions. |
| `POST /duels` (auth) `{matchId, opponentId, won}` | 202. 409 for a second report on the same match, 404 for an unknown opponent, 400 for a bad body.                                                                                              |
| `GET /leaderboard`                                | `{maze: {allTime, week}, duels: {allTime, week}}`, each a top 10. Cached for 60 s.                                                                                                            |

- **Authentication:** `Authorization: Bearer <token>`. The token is 32 random bytes, and only its SHA-256 hash is stored. A missing or wrong token gets 401.
- **Ids:** player and run ids are 16 random bytes in base64url (22 characters). A match id is 12 base64url characters, made by the host.
- **Nickname number:** `INSERT … SELECT COALESCE(MAX(number), 0) + 1 …` in one statement, so two players created at the same time can't get the same number.
- **Maze replay:** `actions` is an ordered list of at most 2000 moves (`"up"`, `"down"`, `"left"`, `"right"`) and answers (`{answer: n}`). The Worker replays them with `createGame({size: 10, robotCount: 10, rng: createRng(seed)})`, `move` and `answer`, the same code the browser runs. Official time = `now − started_at + penaltyMs`.
- **Duels:** a win is recorded when two reports for the same match have reporter and opponent swapped and exactly one says `won`. Reports that disagree are deleted. At most 3 counted wins per winner/loser pair per UTC day.
- **Rankings:**
  - Maze: each player's best time, ascending; ties go to the earlier finish.
  - Duels: number of wins, descending.
  - "This week" counts results finished since Monday 00:00 UTC.
- **Cleanup:** expired unfinished runs (older than 1 h) and unconfirmed duel reports (older than 1 day) are deleted on the next write of their kind.

## Browser

- `src/core/online/nickname.js`: the color and animal lists and `formatNickname`. The Worker imports it too.
- **Storage:** `Player` is `{name, createdAt, account?: {id, token}}`. `name` now holds the nickname. Storage stays at version 1.
- **Players screen:** the name form becomes a **New player** button. It is disabled while waiting. If the Worker can't be reached, "Can't reach the game server" is shown, and the player can press the button again.
- **Migration:** at app start, each player without an `account` is registered and renamed. If that fails, it's tried again at the next start.
- **Prompt:** `src/core/ui/leaderboard-prompt.js`, shared by both games. It is shown only for a player with an account.
- **Robot Maze:**
  - The timer starts when the maze appears.
  - With an account, the seed comes from the Worker and the moves are recorded.
  - Offline, or without an account, the game plays with `Math.random` and shows no prompt.
- **Tug of War:**
  - `hello` gains `playerId` (the public id, or `null`), and `start` gains `matchId`.
  - The prompt appears only when both players have an id.
- **Leaderboard screen:** sections for Robot Maze and Tug of War, each with "All time" and "This week" tables. The current player's row is highlighted.

## Tests

- **Worker (`tests/worker/`):** `players`, `maze-runs`, `duels` and `leaderboard`, run on `node:sqlite` with the real migrations.
- **Pure logic:**
  - `nickname`;
  - the new protocol fields;
  - `setAccount` in `profiles`;
  - the same seed always giving the same game in `state`.
- **End to end:** the headless two-browser scripts cover migration, a new player, a maze added to the leaderboard, and a duel confirmed by both players.
