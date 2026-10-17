# Plan: Small improvements: no mistake tracking, mobile-first, header drawer, maze without the pad

## Summary

Four small changes, one commit each, on a new branch `mobile-improvements` from `master`:

1. **Stop tracking mistakes.**
   - The "Most missed" list leaves the players page.
   - Saved runs no longer store a mistake list. Old saved lists are dropped by a storage migration to version 3.
   - The Robot Maze result card still shows the round's mistake count, which is never stored.
2. **Mobile requirements.** A new requirement section says every screen works from 360 px wide in portrait, by touch alone, with comfortable tap targets and no sideways scrolling.
3. **Header drawer.** Below 600 px the header shows only the title and a ☰ button. The button opens a drawer from the right with Leaderboard, Player and the language switcher. The drawer closes on a link, a tap outside or Esc.
4. **Robot Maze without the on-screen pad.** You move with the keys or by tapping a neighbouring cell, which already works (R4.4). The pad under the board goes away, so the maze can be bigger on phones.

## Context

The user wants the app simpler and better on phones. Decisions made with the user:

| Topic      | Decision                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Maze moves | Remove the on-screen pad; keys + tapping a neighbouring cell                                                 |
| Drawer     | Title + ☰ in the bar; the drawer holds Leaderboard, Player and language; closes on link, outside tap or Esc |
| Mistakes   | Keep the round's count on the maze result card; store nothing; drop old lists from storage                   |
| Mobile     | Phones from 360 px, touch-first, tap targets ≥ 44 px, no double-tap zoom on controls, drawer below 600 px    |

Workflow (project rules): requirements in `docs/` → failing tests for review → implementation → checks and phone-sized screenshots → commits listed for confirmation.

## 1. Stop tracking mistakes

- `src/core/storage.js`:
  - `VERSION = 3`. A run is `{gameId, finishedAt, timeMs, penaltyMs}`.
  - `loadData` migrates version 2 by dropping `mistakes` from each run. Version 1 goes through `_fromVersion1` and then the same step.
  - Any other version is still an error (R3.6).
- `src/core/profiles.js`: remove `missedFacts` and `MissedFact`.
- `src/screens/players.js`: remove the missed list (`MISSED_FACTS_SHOWN`, the heading and the list).
- `src/i18n/pl.js` and `en.js`: remove `players.missed` and `players.missedFact`.
- `css/base.css`: remove `.missed-facts`.
- `src/core/registry.js`: `RunResult` becomes `timeMs | penaltyMs`.
- `src/games/robot-maze/index.js`: `recordRun({timeMs, penaltyMs})`. The result card still gets `state.mistakes.length`. `state.mistakes` stays in the game state, because it counts this round's wrong answers.
- Requirements:
  - R3.3: drop `mistakes` from the run.
  - R3.5: remove it.
  - R3.6: version 3, and the migration from versions 1 and 2.
  - R4.7: keep the in-round count only.
- Tests:
  - `tests/storage.test.js`: version 2 data loads with the mistakes dropped; version 1 migrates to the version 3 shape; saving writes version 3.
  - `tests/profiles.test.js`: remove the `missedFacts` tests.
  - `tests/players.test.js`: the page no longer shows "Most missed".

## 2. Mobile requirements

New **R10 – Phones and tablets** in `docs/requirements.md`:

- Every screen works from 360 px wide in portrait without sideways scrolling.
- Every game is playable by touch alone.
- Buttons and controls are at least 44 px tall. Maze cells are as big as the screen width allows.
- Game controls don't zoom on a double tap (`touch-action: manipulation`).
- Below 600 px the header folds into a drawer (R10 points to the header rule).
- Typing an answer doesn't need the phone's keyboard; the number pad (R4.8, R7.7) covers it.

I'll fix any gap the screenshots reveal (step 4 of the verification) and note it in the commit.

## 3. Header drawer

- `src/screens/header.js`: the bar keeps the brand. The leaderboard link, player link and language select move into a `<nav class="site-nav" id="site-nav">`. A `<button class="nav-toggle" aria-controls="site-nav" aria-expanded="false" aria-label="Menu">☰</button>` sits next to them, plus a backdrop element.
  - Toggling sets `is-open` on the header and updates `aria-expanded`.
  - The backdrop click and Esc close the drawer.
  - A link click closes it as well. The route change re-renders the header, but close explicitly anyway.
  - The Esc listener goes on `document` while the drawer is open and is removed when it closes.
- New i18n key `header.menu` ("Menu" / "Menu") for the button's label.
- `css/base.css`:
  - From 600 px up, the nav shows inline as today and the toggle and backdrop are hidden.
  - Below 600 px, the nav is a fixed panel on the right (full height, `width: min(80vw, 280px)`, items stacked, 44 px rows). It is hidden until `.is-open`, slides in with `transform`, and sits above a dimmed backdrop. A `prefers-reduced-motion` rule turns off the slide.
  - The old 480 px rule that hid the leaderboard label goes away.
- Tests in `tests/header.test.js` (jsdom):
  - The toggle opens the drawer and sets `aria-expanded="true"`; a second press closes it.
  - Esc closes it. A backdrop click closes it. Clicking a nav link closes it.
  - The leaderboard link, player link and language select are inside the nav.

## 4. Robot Maze without the pad

- `src/games/robot-maze/index.js`: drop `createDpad(tryMove, t)`. Tapping uses the existing `_directionTowards` and keys use `KEY_DIRECTIONS`.
- `src/core/ui/dpad.js` is no longer used by any game, so delete it and its `.dpad*` styles in `css/base.css`.
  - The `dpad.left` / `dpad.right` translations stay, because Color Invasion's ◀/▶ buttons use them as labels.
  - `dpad.up` / `dpad.down` go, since nothing uses them.
- `src/games/robot-maze/i18n.js`: the goal text mentions tapping a neighbouring cell or using the arrow keys.
- Requirements: R1.4 (only the number pad is a core component now) and R4.4 (keys or tapping; no pad).
- Tests: in `tests/robot-maze-round.test.js`, a tap on the cell next to the player moves the player. It works the same way the existing keyboard test does.

## Verification

1. `npm test`, lint, typecheck, deadcode, format:check after each commit.
2. Storage migration: load a saved version 2 blob (the test covers it) and confirm stats still show the best time.
3. Headless Chrome against the local dev server at 360×740 with touch emulation (`Emulation.setTouchEmulationEnabled`), in light and dark mode:
   - Home, players, leaderboard, Robot Maze (tap moves, dialog, result) and Color Invasion: screenshots, and `scrollWidth ≤ innerWidth` on each.
   - The drawer opened and closed.
   - Everything checked again at 1024 px to confirm the desktop header is unchanged.
4. List the files per commit and wait for confirmation before committing. Pushing and deploying only when asked.
