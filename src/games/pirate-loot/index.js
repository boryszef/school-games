import { log } from "../../core/log.js";
import { finishServerRun, startServerRun } from "../../core/online/server-run.js";
import { createRng } from "../../core/random.js";
import { createTimer } from "../../core/timer.js";
import { h, loadStylesheet } from "../../core/ui/dom.js";
import { submitToLeaderboard } from "../../core/ui/leaderboard-submit.js";
import { messages } from "./i18n.js";
import { createPanel } from "./panel.js";
import { createResultPanel } from "./result.js";
import { createScene } from "./scene.js";
import { answerLimitMs, createGame, retire, sailAgain, split } from "./state.js";

/** @typedef {import("../../core/registry.js").GameContext} GameContext */
/** @typedef {import("../../core/online/server-run.js").ServerRun} ServerRun */
/** @typedef {import("./state.js").GameState} GameState */
/** @typedef {{answer: number | null, ms: number} | "sail" | "retire"} Action Replayed by the Worker (R8.7). */

/** How long the crew boards and the ship sails before reaching the island. */
const SAIL_MS = 1600;
/** How long the chest takes to open before the question. */
const DOCK_MS = 800;
/** How long the captain takes to walk the plank before the result. */
const PLANK_MS = 2600;
const PATIENCE_REFRESH_MS = 100;

/** @type {import("../../core/registry.js").GameDefinition} */
export const pirateLoot = {
  id: "pirate-loot",
  titleKey: "pirateLoot.title",
  icon: "🏴‍☠️",
  messages,
  mount(root, ctx) {
    loadStylesheet(new URL("./style.css", import.meta.url).href);
    let stopGame = () => {};
    const play = () => {
      stopGame();
      stopGame = _startGame(root, ctx, play);
    };
    play();
    return () => stopGame();
  },
};

/**
 * Gets a server-checked run for a registered player, then plays the game; returns a cleanup
 * function.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {() => void} playAgain
 */
function _startGame(root, ctx, playAgain) {
  let cancelled = false;
  let stopGame = () => {};
  root.replaceChildren(h("p", { class: "pl-preparing" }, ctx.t("pirateLoot.preparing")));
  startServerRun(ctx.player.account, "/pirate-runs", {}).then((run) => {
    if (!cancelled) stopGame = _playGame(root, ctx, run, playAgain);
  });
  return () => {
    cancelled = true;
    stopGame();
  };
}

/**
 * Plays trips until the captain retires or goes overboard; returns a cleanup function.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {ServerRun | null} run
 * @param {() => void} playAgain
 */
function _playGame(root, ctx, run, playAgain) {
  const { t } = ctx;
  const rng = run === null ? Math.random : createRng(run.seed);
  let state = createGame(rng);
  /** @type {Action[]} */
  const actions = [];
  /** @type {Set<ReturnType<typeof setTimeout>>} */
  const pending = new Set();
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let patienceTicker;
  let timer = createTimer();

  const hud = h("p", { class: "pl-hud" });
  const scene = createScene(t);
  const panel = createPanel(t, { onAnswer: answer, onSail: sail, onRetire: retireNow });
  root.replaceChildren(
    h(
      "div",
      { class: "pl" },
      h("p", { class: "pl-goal" }, t("pirateLoot.goal")),
      hud,
      scene.element,
      panel.element,
    ),
  );
  startTrip();

  /**
   * @param {() => void} action
   * @param {number} ms
   */
  function later(action, ms) {
    const id = setTimeout(() => {
      pending.delete(id);
      action();
    }, ms);
    pending.add(id);
  }

  function startTrip() {
    log.debug("trip", state.trip, "crew", state.crew, "treasure", state.treasure);
    showHud();
    panel.hide();
    scene.sail(state.crew, state.treasure);
    later(() => scene.dock(), SAIL_MS);
    later(ask, SAIL_MS + DOCK_MS);
  }

  function showHud() {
    hud.textContent = `${t("pirateLoot.trip", { trip: state.trip })} · ${t("pirateLoot.loot", { loot: state.loot })}`;
  }

  function ask() {
    panel.ask(state.crew);
    timer = createTimer();
    timer.start();
    patienceTicker = setInterval(checkPatience, PATIENCE_REFRESH_MS);
    checkPatience();
  }

  function checkPatience() {
    const limitMs = answerLimitMs(state.trip);
    const remainingMs = Math.max(0, limitMs - timer.elapsedMs());
    panel.showPatience(remainingMs, limitMs);
    if (remainingMs === 0) settle(null, limitMs);
  }

  /** @param {number} value */
  function answer(value) {
    settle(value, Math.round(timer.elapsedMs()));
  }

  /**
   * @param {number | null} value
   * @param {number} ms
   */
  function settle(value, ms) {
    clearInterval(patienceTicker);
    actions.push({ answer: value, ms });
    const before = state;
    state = split(state, value, ms);
    log.debug("split", value, "in", ms, "ms:", state.status);
    if (state.status === "choosing") {
      const share = state.treasure / state.crew;
      showHud();
      scene.deal(share);
      panel.offerChoice(share, state.loot);
      return;
    }
    panel.hide();
    scene.overboard();
    later(() => finish(before.loot), PLANK_MS);
  }

  function sail() {
    actions.push("sail");
    state = sailAgain(state, rng);
    startTrip();
  }

  function retireNow() {
    actions.push("retire");
    state = retire(state);
    finish(state.loot);
  }

  /** @param {number} lostLoot What the captain had before going overboard. */
  function finish(lostLoot) {
    stop();
    log.info(
      `pirate loot ended ${state.status} after ${state.trip} trips with ${state.loot} coins`,
    );
    // Only a retired captain has a score for the leaderboard.
    const sendScore = run !== null && state.status === "retired";
    root.append(
      createResultPanel(
        t,
        { state, lostLoot },
        { onPlayAgain: playAgain, onHome: ctx.exit },
        sendScore
          ? submitToLeaderboard(t, async () => {
              await finishServerRun(run, actions);
              return null;
            })
          : null,
      ),
    );
  }

  function stop() {
    clearInterval(patienceTicker);
    for (const id of pending) clearTimeout(id);
    pending.clear();
  }

  return stop;
}
