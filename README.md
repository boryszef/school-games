# Education games / Gry edukacyjne

## Summary

Small learning games for young kids. The app runs in the browser: it is static HTML, CSS and JavaScript with nothing fetched or installed at runtime. Two-player games connect the players' browsers directly to each other. A small Cloudflare Worker on the free tier helps them find each other and keeps an online leaderboard. Players get generated nicknames such as `RedFox1`, so no real names are stored anywhere. Progress is kept in the browser's `localStorage`. The interface is in Polish and English.

▶ **Play: https://boryszef.github.io/school-games/**

## Games

### 🤖 Robot Maze (Labirynt robotów)

Practises the 10×10 multiplication table. The player walks through a 10×10 maze from the top-left corner to the flag 🏁. Rows and columns are numbered 1–10, like a multiplication table.

Ten robots stand on the way to the flag. To get past a robot in row _r_ and column _c_, type the answer to _r_ × _c_. A wrong answer adds 5 seconds and the child tries again. The faster the better: the player's best time and most-missed products appear on the players screen.

Controls: the arrow keys or WASD, the on-screen arrows, or tapping the next cell. Answers can be typed or entered with the on-screen number pad.

**🦾 Robot Maze – hard** is the same game on a 20×20 maze with 20 robots, so the questions go up to 20 × 20. It has its own tile, best time and leaderboard.

### 🪢 Tug of War (Przeciąganie liny)

A multiplication duel for two players on two devices. Both players get the same question, from 2 × 2 to 10 × 10. The faster correct answer pulls the rope one step towards that player, and the first to pull it 5 steps to their side wins. A wrong answer freezes the player for 2 seconds.

To play, one player opens the game and gets a 6-character game code, shown in large letters, as a QR code and as a link. The other player scans the QR code with the camera app, opens the link, or types the code under "Have a code from a friend?", and the match starts.

#### How the connection works

The browsers talk to each other over a WebRTC data channel (`src/core/net/`). To set it up, each side has to learn the other's network addresses and encryption fingerprint. The host's description (the "offer") and the guest's reply (the "answer") are passed through a small Cloudflare Worker (`worker/`) under the game code. The Worker deletes the room as soon as the host has the answer, or after 10 minutes at most.

Game traffic never passes through any server. Cloudflare's free STUN server tells each browser its public address. There is no TURN relay, because Cloudflare TURN needs a payment card on file. So some strict networks (some schools, offices and mobile carriers) block the direct connection, and the game then says so. Players on the same Wi-Fi almost always connect.

### 🏴‍☠️ Pirate Loot (Skarb piratów)

Practises division, the 10×10 multiplication table backwards. The player is a pirate captain. On each trip a crew of 2–10 pirates (the captain included) finds a chest of up to 100 gold coins, and the captain types how many coins each pirate gets. The treasure always splits evenly, so every answer is 1–10.

The crew is impatient: 15 seconds to answer on the first trip, a second less on every trip after that, down to 4 seconds. A right answer adds the captain's share to the loot, and the captain chooses to sail again or retire with the loot. A wrong or late answer gets the captain thrown overboard, and the loot is lost.

## Players and the leaderboard

There are no typed names. **New player** asks the Worker for a nickname `<Color><Animal><N>`, such as `RedFox1`. The Worker picks the color and animal at random, and `N` is the next free number for that pair, so nicknames are unique. Creating a player therefore needs internet; playing doesn't. Players created before nicknames existed are renamed automatically the next time the app starts online.

After every finished game the score is added to the leaderboard automatically (`#/leaderboard`, top 10 per game, all-time and this week):

- **Robot Maze** times are measured by the Worker, not the browser. The maze is built from a seed the Worker hands out when the round starts. When the round ends, the Worker replays the recorded moves and answers with the game's own rules (`src/games/robot-maze/state.js`). It counts the run only if the replay reaches the flag, and the time is its own clock plus the penalties.
- **Pirate Loot** scores are the loot of a captain who retired. Like Robot Maze, every crew and treasure comes from the Worker's seed, and the Worker replays the answers to get the loot. A game that ends overboard has no score and isn't sent.
- **Tug of War** wins count only when both players' reports agree, and at most 3 wins against the same opponent count per day.

Each player has a secret token, of which the Worker keeps only a hash. The Worker stores no IP addresses.

## Development

Requires [nvm](https://github.com/nvm-sh/nvm). The Node version is pinned in `.nvmrc`, and the Node tools are for development only.

```sh
nvm use
npm ci
npm run dev          # the game, a local Worker and a local database
```

`npm run dev` applies the database migrations locally, then serves the game on port 8000 and the Worker on port 8787. It prints the addresses to open: `http://localhost:8000/` on this computer and `http://<Wi-Fi address>:8000/` on a phone or tablet on the same Wi-Fi. Ctrl+C stops both.

Manual testing never touches the real data: only the page served from `boryszef.github.io` talks to the production Worker. A page from any other address talks to the local Worker on that same address, and the production Worker refuses requests from local pages.

- Phones need the computer's firewall to allow ports 8000 and 8787.
- The browser keeps players per address, so `localhost` and the Wi-Fi address each have their own player.
- `npm run dev:reset` wipes the local database (players, maze runs, wins). Stop `npm run dev` first. Players saved in browsers then no longer exist on the local Worker, so also clear the site data in those browsers.

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
worker/                Cloudflare Worker: rooms for two-player games, players and the leaderboard
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

`fonts/emoji-subset.woff2` is a 12 KB subset of [Noto Color Emoji](https://github.com/googlefonts/noto-emoji) (OFL 1.1). It contains only the emoji the app uses, for devices without their own emoji font. If you add a new emoji to the UI, rebuild the font with the command in `css/base.css` and extend its `unicode-range`.

## Deployment

Every push to `master` runs the checks, deploys the Worker (applying new D1 migrations first) and then publishes the app to GitHub Pages (`.github/workflows/pages.yml`). Only `index.html`, `css/`, `src/` and `fonts/` are published to Pages.

### One-time Cloudflare setup

Everything below fits in Cloudflare's free tier, and no payment card is needed.

1. Create a Cloudflare account, then run `npx wrangler login`.
2. Run `npx wrangler d1 create school-games`, and put the printed `database_id` into `worker/wrangler.jsonc`.
3. Create an API token with the "Edit Cloudflare Workers" template plus D1 edit rights. Add it and your account id to the GitHub repository secrets as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. After the first deploy, put the Worker's `*.workers.dev` address into `API_URL` in `src/core/online/api.js`.

## License

[MIT](LICENSE). The bundled emoji font is under the [SIL Open Font License 1.1](fonts/LICENSE-NotoColorEmoji.txt). `src/vendor/qrcodegen.js` is Project Nayuki's [QR Code generator library](https://www.nayuki.io/page/qr-code-generator-library) (MIT); its header names the upstream commit.
