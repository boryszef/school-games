# School Games: plan for the first game, "Robot Maze" (10×10 multiplication)

## Summary

A static, dependency-free web app (HTML + ES-module JS + CSS) that hosts small learning games. The first game is a 10×10 maze. Rows and columns are numbered 1–10. **10 robots** sit on the path to the exit, and a robot at (row r, column c) lets the player through only after they type **r × c**. A wrong answer adds **+5 s** and the child tries again. The goal is to reach the exit as fast as possible. Everything is stored in `localStorage`: player profiles, best time, run history and the most-missed products. The UI is in **Polish and English**. It works with the keyboard and with touch (on-screen d-pad and number pad). A game registry and a small game interface let future games plug in without touching the core. Dev-only npm tooling (ESLint, Prettier, `tsc --checkJs`, knip, `node --test`) guards the repo through `pre-commit`.

## Context

The repo `/storage/borys/github/school-games` is empty (only `.claude/`). It is not a git repo yet. The goal is to gamify learning the 10×10 multiplication table for young kids. The app must be hostable as static files with no backend, and it must be open to more games later.

Decisions confirmed with the user:

- PL + EN UI, with a switcher.
- Desktop and touch input.
- Wrong answer: +5 s, then retry.
- Player profiles with best time, history and most-missed products. The stats are **shown only** and don't influence robot placement.
- Fixed robot count of 10, so there is a single leaderboard.
- ES modules served over http (`python3 -m http.server` locally).
- Dev-only npm tooling.

## Workflow (per project rules)

1. After plan approval, `git init` and write `docs/requirements.md`, which converts this plan into numbered requirements and starts with a Summary.
2. Set up the tooling: `package.json` (dev deps pinned), `eslint.config.js`, `.prettierrc`, `jsconfig.json` (`checkJs`, `strict`), knip config, `.pre-commit-config.yaml`.
3. Write failing unit tests for the pure logic first and **let the user review them**.
4. Implement, then verify in the browser.
5. Before each commit, list the staged file names and get confirmation.

## Structure

```
index.html                 shell: header (player, language), <main id="app">
css/base.css               design tokens, layout, buttons, keypad/d-pad
src/main.js                boot: load storage, i18n, register games, start router
src/core/
  log.js                   tiny logger (debug/info; debug enabled via ?debug=1)
  router.js                hash routes: #/ (home), #/players, #/game/<id>
  registry.js              registerGame(def), listGames(), getGame(id)
  storage.js               single localStorage key "schoolGames", {version, data}
  profiles.js              create/select player; recordRun(); bestTime(); missedFacts()
  i18n.js                  t(key, params), setLang(); merges core + per-game dictionaries
  timer.js                 elapsed time via performance.now() + penalties
  ui/numpad.js             reusable on-screen number pad (future games reuse it)
  ui/dpad.js               reusable on-screen direction pad
src/i18n/pl.js, en.js      core strings
src/screens/home.js        game tiles from the registry
src/screens/players.js     choose or create a player; best time, last runs, most-missed products
src/screens/header.js, game.js, not-found.js
src/core/app.js            app state, persistence, dictionaries, screen dispatch
src/core/format.js         m:ss.t time formatting
src/games/robot-maze/
  index.js                 game definition + mount(); wires the modules below
  maze.js                  pure: generateMaze(rng) → walls per cell (recursive backtracker)
  path.js                  pure: shortestPath(maze, from, to) (BFS)
  robots.js                pure: placeRobots(path, count, rng): 10 distinct cells, not start or exit
  state.js                 pure: game state + reducer (move, answer, finish)
  board.js                 DOM: CSS-grid board with axis labels 1–10, player, robots, exit
  challenge.js             DOM: "r × c = ?" overlay with input + numpad
  result.js                DOM: finish overlay (time, mistakes, record)
  i18n.js                  game strings (pl/en)
  style.css
src/core/random.js         seeded RNG (mulberry32) so the logic is deterministic in tests
tests/*.test.js            node --test for the pure modules
```

### Game plug-in contract (`registry.js`)

```js
/** @typedef {{ id: string, titleKey: string, icon: string,
 *   messages: {pl: object, en: object},
 *   mount(root: HTMLElement, ctx: GameContext): () => void }} GameDefinition */
/** GameContext = { player, t, recordRun(result), exit() } */
```

A future game is a new folder under `src/games/` plus one `registerGame(...)` line in `main.js`.

## Game rules (robot-maze)

- 10×10 perfect maze, regenerated for every game. The start is at cell (1,1) and the exit at (10,10). The axes show 1–10 on the top and on the left, like a multiplication table.
- 10 robots sit on distinct cells of the start→exit path, never on the start or the exit. The path always has at least 19 cells, so they can't be bypassed.
- Movement: arrows/WASD, the on-screen d-pad, or tapping an adjacent open cell. Walls block movement.
- Stepping into an active robot's cell opens a prompt: "r × c = ?". The prompt has a numeric input (`inputmode="numeric"`) and the on-screen numpad.
  - Correct: the robot is disabled (greyed out) and the player moves in.
  - Wrong: +5 s penalty, the input shakes, the "try again" text shows, and the child retries the same robot. The fact (r,c) is recorded as missed.
- The timer starts on the first move and stops at the exit. The result screen shows the time (penalties included), the number of mistakes, and whether it's a new personal best. Buttons: "Play again" and "Home".

## Persistence (`storage.js`, `profiles.js`)

```js
{ version: 1, data: {
  lang: "pl", currentPlayerId,
  players: { [id]: { name, createdAt } },
  runs: [ { playerId, gameId, finishedAt, timeMs, penaltyMs, mistakes: [[r,c], ...] } ]
}}
```

- The best time and the most-missed products are derived from `runs`. They aren't stored separately, so there is no denormalised state to keep in sync.
- Storage is written after every finished run and after profile or language changes.

## Tests (written first, for user review)

- `maze.test.js`: every cell is reachable (perfect maze); the walls are symmetric between neighbours; the same seed produces the same maze.
- `path.test.js`: the path starts at (1,1), ends at (10,10), and each step is an open neighbour.
- `robots.test.js`: 10 distinct cells, all on the path, not on the start or the exit.
- `state.test.js`: a move into a wall is ignored; a move into a robot opens a challenge; a wrong answer adds 5000 ms and records the mistake; a correct answer disables the robot and moves the player; reaching the exit finishes the game.
- `profiles.test.js`: recordRun stores the run; bestTime picks the minimum per player; missedFacts ranks the products by frequency.
- `i18n.test.js`: a missing key in either language is reported by a test that compares the pl and en key sets.

## Verification

- `npm test` (`node --test`) and `pre-commit run --all-files` (eslint, prettier, tsc, knip).
- Manual run: `python3 -m http.server` → http://localhost:8000. Then check that:
  - you can create a player;
  - the game plays end to end with the keyboard;
  - a wrong answer adds +5 s;
  - you can finish, and the best time shows on the players screen;
  - switching to EN and reloading keeps the state;
  - in narrow devtools mode with touch emulation, the d-pad and numpad work.
