# Plan: "Color Invasion" – color names in English, German and Spanish

## Summary

A new single-player game **Color Invasion / Kolorowa inwazja** (`color-invasion`, icon 👾). Ten columns of five boxes, one color per column (red, orange, yellow, green, blue, purple, pink, brown, black, white), sit at the top of the board. Their order is shuffled each round. A ship at the bottom moves one column per step and shoots the lowest box in the column above it. A color name in the chosen language (EN, DE or ES) is shown. A correct hit pops the box for +1. A wrong color costs −1: the box stays and shakes, and the score may go negative. After every shot a new color is picked, never the same one twice in a row. Popping the last box of a column gives +5 and refills that column. A round lasts 60 s and starts as soon as the language is picked. At the end a result card shows the score. Nothing is stored or sent to the leaderboard.

## Context

The project hosts learning games for kids (static ES modules, plug-in `GameDefinition` contract in `src/core/registry.js`). The user wants a game that trains color vocabulary in foreign languages, styled after Space Invaders or Breakout. Decisions made with the user:

| Topic           | Decision                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Language choice | Picker inside the game (English / Deutsch / Español buttons), one home tile                    |
| Results         | Result card only. No local stats, no leaderboard (possible follow-up)                          |
| Colors          | 10: red, orange, yellow, green, blue, purple, pink, brown, black, white                        |
| Speech          | Text only                                                                                      |
| Controls        | Column steps: ←/→ or A/D, Space to shoot; on-screen ◀ 🔥 ▶ buttons; tap a column to move there |
| Column size     | 5 boxes; a shot hits the lowest box of the column above the ship                               |
| Wrong shot      | −1, box stays (shake/red flash); score can go negative                                         |
| Bonus           | Last box popped by a correct hit: +5, column refills with 5 boxes of the same color            |
| Layout          | Column order shuffled at round start; refilled columns stay in place                           |
| Target color    | New color after every shot, never the same as the previous one                                 |
| Round start     | Immediately after choosing the language; 60 s countdown                                        |

The UI language stays pl/en (R2). The _target_ language (en/de/es) is a separate game setting. It is remembered in memory for the session, so "Play again" and coming back from home pre-select it. Keeping it across reloads would need a storage format change (R3.2/R3.3), so that is left as a follow-up if wanted.

Workflow (project rules): plan → requirements in `docs/` → failing tests for user review → implementation.

## Files

### New: `src/games/color-invasion/`

- **`colors.js`**: pure data. `COLORS`: the ordered list of 10 color ids, each with its CSS value. `COLOR_NAMES`: `{en, de, es}` → id → word. `TARGET_LANGUAGES`: `{en: "English", de: "Deutsch", es: "Español"}` (shown in the language's own name).
  - en: red, orange, yellow, green, blue, purple, pink, brown, black, white
  - de: rot, orange, gelb, grün, blau, lila, rosa, braun, schwarz, weiß
  - es: rojo, naranja, amarillo, verde, azul, morado, rosa, marrón, negro, blanco
- **`state.js`**: pure, immutable game logic. Randomness comes from an injected `rng` (`src/core/random.js` `Rng`), as in robot-maze `state.js`.
  - Constants: `ROUND_MS = 60_000`, `BOXES_PER_COLUMN = 5`, `HIT_POINTS = 1`, `MISS_POINTS = -1`, `CLEAR_BONUS = 5`.
  - `createRound(rng)` → `{columns: [{color, boxes}], shipColumn, target, score, hits, misses, clears}`. Columns are shuffled with Fisher–Yates using `rng`, and the ship starts at the middle column.
  - `moveShip(state, "left" | "right")`: clamped at the edges, so it returns the same state when nothing moves. `moveShipTo(state, column)` handles taps.
  - `shoot(state, rng)` → `{state, outcome}`. `outcome` is `"hit" | "clear" | "miss"`: it applies the scoring rules above, then picks the next target.
  - `_pickTarget(previous, rng)`: a random color other than `previous`.
- **`board.js`**: DOM view (`createBoard(onColumnTap)` → `{element, update(state), flash(outcome, column)}`). It uses a CSS grid of 10 columns × 5 rows plus the ship row. A short laser animation for the shot, a pop animation for a hit and a shake for a miss are purely visual: the state changes immediately. Black and white boxes get a border so they show in both color schemes.
- **`index.js`**: `GameDefinition`. `mount` shows the language picker, then plays a round:
  - The timer (`createTimer` from `src/core/timer.js`) and a 100 ms ticker show the remaining time.
  - Key handling works like robot-maze `index.js` (`KEY_DIRECTIONS`-style map with A/D/arrows and Space, plus `preventDefault`).
  - It renders the on-screen ◀ 🔥 ▶ controls.
  - At 60 s it stops input and shows the result card. The returned unmount clears the interval and the key listener.
- **`picker.js`**: the language picker (one button per target language, the last one chosen highlighted and focused).
- **`result.js`**: result card with the score, the correct hits, the mistakes and the columns cleared, plus "Play again" (same language) and "Choose another game". It follows robot-maze `result.js` (overlay + card + `button` / `button secondary` classes).
- **`i18n.js`**: pl/en UI strings (`colorInvasion.title`, `.chooseLanguage`, `.shoot`, `.score`, `.timeLeft`, `.target`, result strings, `.playAgain`, `.home`, aria labels for the ◀/▶/🔥 buttons).
- **`style.css`**: board, boxes, ship, laser, animations and target word (large, neutral color, never painted in the target color). Prefix `ci-`. It uses the theme tokens from `css/base.css`.

### Changed

- `src/main.js`: `registerGame(colorInvasion)`.
- `css/base.css` + `fonts/emoji-subset.woff2`: add 👾 U+1F47E, 🚀 U+1F680 (ship) and 🔥 U+1F525 (shoot button) to the emoji subset and `unicode-range`. The rebuild command is in the file header. `tests/emoji-font.test.js` enforces it.
- `docs/requirements.md`: new section **R9 – Color Invasion rules**. Update the Summary, R5.1 (unit-tested logic) and R2 (note that the target language is separate from the UI language).
- `docs/plan-color-invasion.md`: this plan.

## Reuse

- `h`, `loadStylesheet` from `src/core/ui/dom.js`
- `createTimer` from `src/core/timer.js`
- `createRng` / `Rng` from `src/core/random.js`: seeded in tests, `Math.random` in the game
- `log` from `src/core/log.js`: debug at round start (column order, language), on each shot (outcome, score) and at round end; info for the final score
- The existing `dpad` styles are not reused, because only left/right plus shoot are needed. The ◀/▶/🔥 buttons are a small local control, not a core component (YAGNI).

## Tests (written first, for user review)

- `tests/color-invasion-state.test.js`, using `createRng` seeds:
  - A round has 10 distinct colors × 5 boxes, the ship sits in the middle, the score is 0, and the target is one of the colors.
  - Different seeds give different column orders.
  - `moveShip` clamps at both edges; `moveShipTo` moves the ship to the given column.
  - Correct shot: +1, the column loses 1 box, `hits` +1.
  - Wrong shot: −1, the boxes are unchanged, `misses` +1, and the score goes below 0 from 0.
  - Popping the last box: +1 +5, the column refills to 5 with the same color, `clears` +1.
  - The target always changes after a shot, including a miss (many shots, never equal to the previous one).
- `tests/color-invasion-colors.test.js`: each language names exactly the 10 color ids, with no empty or duplicate words within a language.
- `tests/i18n.test.js`: add the pl/en key-parity test for the new dictionaries.

## Verification

1. `npm test`, `npm run lint`, `npm run typecheck`, `npm run deadcode`, `npm run format:check` (also run by pre-commit).
2. `npm run dev`, then open `#/game/color-invasion`:
   - Pick each language and check that the words appear.
   - Move with the keys, the buttons and taps, and shoot.
   - Check the scoring (+1, −1 below zero, +5 with a refill) and that the target never repeats.
   - Check that the round ends at 60 s with the result card, and that Play again keeps the language.
   - Check phone width and dark mode (black and white boxes visible).

## Follow-ups (not in scope)

- Remember the target language across reloads (needs a storage change).
- Local best score and/or leaderboard (needs a score-based Run format; the leaderboard would need a server check to be fair).
- Spoken color names.
