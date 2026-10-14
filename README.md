# Education games / Gry edukacyjne

## Summary

Small learning games for young kids. The app runs entirely in the browser: it is static HTML, CSS and JavaScript with no backend and no runtime dependencies. Progress is kept in the browser's `localStorage`. The interface is in Polish and English.

▶ **Play: https://boryszef.github.io/school-games/**

## Games

### 🤖 Robot Maze (Labirynt robotów)

Practises the 10×10 multiplication table. The player walks through a 10×10 maze from the top-left corner to the flag 🏁. Rows and columns are numbered 1–10, like a multiplication table.

Ten robots stand on the way to the flag. To get past a robot in row _r_ and column _c_, type the answer to _r_ × _c_. A wrong answer adds 5 seconds and the child tries again. The faster the better: the player's best time and most-missed products appear on the players screen.

Controls: the arrow keys or WASD, the on-screen arrows, or tapping the next cell. Answers can be typed or entered with the on-screen number pad.

## Development

Requires [nvm](https://github.com/nvm-sh/nvm). The Node version is pinned in `.nvmrc`, and the Node tools are for development only.

```sh
nvm use
npm ci
npm run serve        # http://localhost:8000
```

ES modules need to be served over HTTP, so opening `index.html` directly from disk won't work.

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm test`          | Unit tests (`node --test`)          |
| `npm run lint`      | ESLint                              |
| `npm run typecheck` | TypeScript check of the JSDoc types |
| `npm run deadcode`  | Unused code and exports (knip)      |
| `npm run format`    | Prettier                            |

Pre-commit hooks run all of the above. Install them once with `uv tool install pre-commit && pre-commit install`.

### Layout

```
index.html, css/       page shell and shared styles
fonts/                 emoji fallback font (see below)
src/core/              app, routing, storage, players, i18n, shared UI (number pad, d-pad)
src/screens/           home, players, game host
src/games/<id>/        one folder per game
tests/                 unit tests for the pure logic
docs/                  plan and requirements
```

### Adding a game

1. Create `src/games/<id>/` with a module that exports a `GameDefinition` (see `src/core/registry.js`). It needs `id`, `titleKey`, `icon`, `messages` (`pl` and `en` dictionaries) and `mount(root, ctx)`, which returns an unmount function.
2. Register it in `src/main.js` with `registerGame(...)`.

The game appears on the home screen. Through `ctx` it receives the current player, the translate function, `recordRun(result)` and `exit()`.

### Emoji font

`fonts/emoji-subset.woff2` is a 7 KB subset of [Noto Color Emoji](https://github.com/googlefonts/noto-emoji) (OFL 1.1). It contains only the emoji the app uses, for devices without their own emoji font. If you add a new emoji to the UI, rebuild the font with the command in `css/base.css` and extend its `unicode-range`.

## Deployment

Every push to `master` runs the checks and publishes the app to GitHub Pages (`.github/workflows/pages.yml`). Only `index.html`, `css/`, `src/` and `fonts/` are published.

## License

[MIT](LICENSE). The bundled emoji font is under the [SIL Open Font License 1.1](fonts/LICENSE-NotoColorEmoji.txt).
