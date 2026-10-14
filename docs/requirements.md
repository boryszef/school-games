# Requirements: School Games platform + "Robot Maze"

## Summary

School Games is a static web app (HTML, CSS and ES-module JavaScript with no runtime dependencies or backend) that hosts learning games for young kids. The first game, **Robot Maze**, practises the 10×10 multiplication table. The child walks through a 10×10 maze. Ten robots block the path to the exit, and each robot is disabled by typing the product of its cell's coordinates. A wrong answer costs 5 seconds. A faster time is a better result. Player profiles, results and statistics are stored only in the browser. The UI is in Polish and English. The platform has a plug-in contract so more games can be added later. Source: [plan.md](plan.md).

## R1 – Platform

- R1.1 The app is static files only: no backend and no runtime third-party dependencies. It must be served over HTTP(S) because it uses ES modules.
- R1.2 Hash routing: `#/` home (list of games), `#/players` (profiles), `#/game/<id>` (a game).
- R1.3 A game is a module that registers a `GameDefinition` (`id`, `titleKey`, `icon`, `messages: {pl, en}`, `mount(root, ctx) → unmount`). The `GameContext` passed to `mount` provides `player`, `t`, `recordRun(result)` and `exit()`. Adding a game means adding a folder under `src/games/` and one registration line.
- R1.4 The on-screen number pad and direction pad are reusable core UI components.
- R1.5 Logging goes through a small logger. Debug output is enabled with `?debug=1`.

## R2 – Internationalisation

- R2.1 Supported languages are Polish (default) and English. A switcher in the header changes the language, and the choice persists.
- R2.2 Core and per-game dictionaries must define the same set of keys in each language.

## R3 – Players and persistence

- R3.1 A player can be created by name and selected. A game can only be started with a selected player.
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

- R5.1 The pure logic (maze, path, robots, game state, profiles, storage, i18n parity) is unit-tested with `node --test`.
- R5.2 Pre-commit hooks run Prettier, ESLint, `tsc --checkJs` (JSDoc types), knip (dead code) and the tests.
- R5.3 The Node version is managed through nvm (`.nvmrc`).
