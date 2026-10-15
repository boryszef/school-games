# Education games / Gry edukacyjne

## Summary

Small learning games for young kids. The app runs in the browser: it is static HTML, CSS and JavaScript with nothing fetched or installed at runtime. Two-player games connect the players' browsers directly to each other; a small Cloudflare Worker on the free tier only helps them find each other. Progress is kept in the browser's `localStorage`. The interface is in Polish and English.

▶ **Play: https://boryszef.github.io/school-games/**

## Games

### 🤖 Robot Maze (Labirynt robotów)

Practises the 10×10 multiplication table. The player walks through a 10×10 maze from the top-left corner to the flag 🏁. Rows and columns are numbered 1–10, like a multiplication table.

Ten robots stand on the way to the flag. To get past a robot in row _r_ and column _c_, type the answer to _r_ × _c_. A wrong answer adds 5 seconds and the child tries again. The faster the better: the player's best time and most-missed products appear on the players screen.

Controls: the arrow keys or WASD, the on-screen arrows, or tapping the next cell. Answers can be typed or entered with the on-screen number pad.

### 🪢 Tug of War (Przeciąganie liny)

A multiplication duel for two players on two devices. Both players get the same question, from 2 × 2 to 10 × 10. The faster correct answer pulls the rope one step towards that player, and the first to pull it 5 steps to their side wins. A wrong answer freezes the player for 2 seconds.

To play, one player opens the game and gets a 6-character game code, shown in large letters, as a QR code and as a link. The other player scans the QR code with the camera app, opens the link, or types the code under "Have a code from a friend?", and the match starts.

#### How the connection works

The browsers talk to each other over a WebRTC data channel (`src/core/net/`). To set it up, each side has to learn the other's network addresses and encryption fingerprint. The host's description (the "offer") and the guest's reply (the "answer") are passed through a small Cloudflare Worker (`worker/`) under the game code. The Worker deletes the room as soon as the host has the answer, or after 10 minutes at most.

The Worker also hands out short-lived TURN credentials from Cloudflare. When two networks block a direct connection (some schools, offices and mobile carriers do), the game traffic goes through Cloudflare's TURN relay instead. Otherwise it never passes through any server.

## Development

Requires [nvm](https://github.com/nvm-sh/nvm). The Node version is pinned in `.nvmrc`, and the Node tools are for development only.

```sh
nvm use
npm ci
npm run serve        # http://localhost:8000
npm run worker:dev   # the Worker with a local database, http://localhost:8787
```

On `localhost` the app uses the local Worker. Before the first `worker:dev`, create the local database with `npx wrangler d1 migrations apply school-games --local --config worker/wrangler.jsonc`. Two-player games need TURN credentials even locally: put `TURN_KEY_API_TOKEN=...` in `worker/.dev.vars` (git-ignored).

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
src/core/net/          peer-to-peer connection: room codes, WebRTC
src/core/online/       calls to the Worker
worker/                Cloudflare Worker: rooms for two-player games, TURN credentials
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

Every push to `master` runs the checks, deploys the Worker (applying new D1 migrations first) and then publishes the app to GitHub Pages (`.github/workflows/pages.yml`). Only `index.html`, `css/`, `src/` and `fonts/` are published to Pages.

### One-time Cloudflare setup

Everything below fits in Cloudflare's free tier, and no payment card is needed.

1. Create a Cloudflare account, then run `npx wrangler login`.
2. Run `npx wrangler d1 create school-games`, and put the printed `database_id` into `worker/wrangler.jsonc`.
3. In the dashboard, under Realtime → TURN, create a TURN key. Put its id into `TURN_KEY_ID` in `worker/wrangler.jsonc`, and store its API token with `npx wrangler secret put TURN_KEY_API_TOKEN --config worker/wrangler.jsonc`.
4. Create an API token with the "Edit Cloudflare Workers" template plus D1 edit rights. Add it and your account id to the GitHub repository secrets as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
5. After the first deploy, put the Worker's `*.workers.dev` address into `API_URL` in `src/core/online/api.js`.

## License

[MIT](LICENSE). The bundled emoji font is under the [SIL Open Font License 1.1](fonts/LICENSE-NotoColorEmoji.txt). `src/vendor/qrcodegen.js` is Project Nayuki's [QR Code generator library](https://www.nayuki.io/page/qr-code-generator-library) (MIT); its header names the upstream commit.
