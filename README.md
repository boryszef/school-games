# Education games / Gry edukacyjne

## Summary

Small learning games for young kids. The app runs entirely in the browser: it is static HTML, CSS and JavaScript with no backend and nothing fetched or installed at runtime. Two-player games connect the players' browsers directly to each other. Progress is kept in the browser's `localStorage`. The interface is in Polish and English.

▶ **Play: https://boryszef.github.io/school-games/**

## Games

### 🤖 Robot Maze (Labirynt robotów)

Practises the 10×10 multiplication table. The player walks through a 10×10 maze from the top-left corner to the flag 🏁. Rows and columns are numbered 1–10, like a multiplication table.

Ten robots stand on the way to the flag. To get past a robot in row _r_ and column _c_, type the answer to _r_ × _c_. A wrong answer adds 5 seconds and the child tries again. The faster the better: the player's best time and most-missed products appear on the players screen.

Controls: the arrow keys or WASD, the on-screen arrows, or tapping the next cell. Answers can be typed or entered with the on-screen number pad.

### 🪢 Tug of War (Przeciąganie liny)

A multiplication duel for two players on two devices. Both players get the same question, from 2 × 2 to 10 × 10. The faster correct answer pulls the rope one step towards that player, and the first to pull it 5 steps to their side wins. A wrong answer freezes the player for 2 seconds.

To play, one player opens the game and shows the invitation QR code (or sends the link). The other player scans it with the camera app and gets an answer code. The first player scans that one with their camera, or pastes the answer link into the game tab, and the match starts.

#### How the connection works

There is no game server. The browsers talk to each other over a WebRTC data channel. To set it up, each side has to learn the other's network address and encryption fingerprint, so an invitation goes one way and an answer comes back (`src/core/net/`). Each code holds only what the connection needs, packed into about 130 characters. A public STUN server (Google's) tells each browser its public address. Game traffic never passes through it.

When the answer link is opened on the inviting device, the new tab passes the answer to the waiting game tab through `BroadcastChannel`. The invitation works only while that tab stays open.

Players on the same Wi-Fi almost always connect. Some strict networks (some schools, offices and mobile carriers) block direct connections, and without a relay server those players can't connect; the game then says so.

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
src/core/              app, routing, storage, players, i18n, shared UI (number pad, d-pad, QR code, two-player lobby)
src/core/net/          peer-to-peer connection: connection codes, WebRTC, answer hand-over between tabs
src/vendor/            vendored third-party code (QR code encoder)
src/screens/           home, players, game host
src/games/<id>/        one folder per game
tests/                 unit tests for the pure logic
docs/                  plan and requirements
```

### Adding a game

1. Create `src/games/<id>/` with a module that exports a `GameDefinition` (see `src/core/registry.js`). It needs `id`, `titleKey`, `icon`, `messages` (`pl` and `en` dictionaries) and `mount(root, ctx)`, which returns an unmount function.
2. Register it in `src/main.js` with `registerGame(...)`.

The game appears on the home screen. Through `ctx` it receives the current player, the translate function, `recordRun(result)`, `exit()` and `arg`, the rest of a `#/game/<id>/<arg>` route.

A two-player game calls `openLobby(root, {gameId, arg: ctx.arg, t})` from `src/core/ui/pvp-lobby.js`. Once the players are connected it resolves to the player's role (`host` or `guest`) and a channel for JSON messages. See `src/games/tug-of-war/` for an example.

### Emoji font

`fonts/emoji-subset.woff2` is a 9 KB subset of [Noto Color Emoji](https://github.com/googlefonts/noto-emoji) (OFL 1.1). It contains only the emoji the app uses, for devices without their own emoji font. If you add a new emoji to the UI, rebuild the font with the command in `css/base.css` and extend its `unicode-range`.

## Deployment

Every push to `master` runs the checks and publishes the app to GitHub Pages (`.github/workflows/pages.yml`). Only `index.html`, `css/`, `src/` and `fonts/` are published.

## License

[MIT](LICENSE). The bundled emoji font is under the [SIL Open Font License 1.1](fonts/LICENSE-NotoColorEmoji.txt). `src/vendor/qrcodegen.js` is Project Nayuki's [QR Code generator library](https://www.nayuki.io/page/qr-code-generator-library) (MIT); its header names the upstream commit.
