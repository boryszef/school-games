import { log } from "./log.js";
import { translate } from "./i18n.js";
import { listGames } from "./registry.js";
import { parseRoute } from "./router.js";
import { registerOldPlayer } from "./online/accounts.js";
import { loadData, saveData } from "./storage.js";
import corePl from "../i18n/pl.js";
import coreEn from "../i18n/en.js";
import { renderHeader } from "../screens/header.js";
import { renderHome } from "../screens/home.js";
import { renderLeaderboard } from "../screens/leaderboard.js";
import { renderPlayers } from "../screens/players.js";
import { renderGameScreen } from "../screens/game.js";
import { renderNotFound } from "../screens/not-found.js";

/** @typedef {import("./storage.js").AppData} AppData */
/** @typedef {import("./i18n.js").Translate} Translate */
/** @typedef {import("./i18n.js").Dictionary} Dictionary */
/** @typedef {import("./router.js").Route} Route */
/**
 * @typedef {object} App
 * @property {AppData} data Current state; read-only, change it with `update`.
 * @property {Translate} t
 * @property {(change: (data: AppData) => AppData) => void} update Applies and persists a change.
 * @property {(hash: string) => void} navigate
 * @property {() => void} refresh Re-renders the header and the current screen.
 * @property {string | null} returnHash Where to go once the player is created, e.g. an invitation
 *   link opened before choosing one.
 */
/** @typedef {(root: HTMLElement, app: App, route: Route) => () => void} Screen Returns unmount. */

/** @type {Record<Route["name"], Screen>} */
const SCREENS = {
  home: renderHome,
  players: renderPlayers,
  leaderboard: renderLeaderboard,
  game: renderGameScreen,
  notFound: renderNotFound,
};

/**
 * @param {HTMLElement} header
 * @param {HTMLElement} main
 */
export function startApp(header, main) {
  let data = loadData(localStorage);
  const dictionaries = _buildDictionaries();
  let unmountScreen = () => {};

  /** @type {App} */
  const app = {
    get data() {
      return data;
    },
    t: (key, params) => translate(dictionaries[data.lang], key, params),
    update(change) {
      data = change(data);
      saveData(localStorage, data);
    },
    navigate(hash) {
      location.hash = hash;
    },
    refresh: render,
    returnHash: null,
  };

  function render() {
    const route = parseRoute(location.hash);
    log.debug("render", route);
    unmountScreen();
    document.documentElement.lang = data.lang;
    document.title = app.t("app.title");
    renderHeader(header, app);
    unmountScreen = SCREENS[route.name](main, app, route);
  }

  window.addEventListener("hashchange", render);
  render();
  // Re-rendering a running game would restart it; it picks up the nickname next time.
  registerOldPlayer(() => data, app.update).then((renamed) => {
    if (renamed && parseRoute(location.hash).name !== "game") render();
  });
}

/** Merges core and per-game dictionaries for each language. */
function _buildDictionaries() {
  /** @type {Record<string, Dictionary>} */
  const dictionaries = { pl: { ...corePl }, en: { ...coreEn } };
  for (const game of listGames()) {
    for (const lang of Object.keys(dictionaries))
      Object.assign(dictionaries[lang], game.messages[lang]);
  }
  return dictionaries;
}
