import { log } from "../../core/log.js";
import { finishServerRun, startServerRun } from "../../core/online/server-run.js";
import { createRng } from "../../core/random.js";
import { createTimer } from "../../core/timer.js";
import { h, loadStylesheet } from "../../core/ui/dom.js";
import { submitToLeaderboard } from "../../core/ui/leaderboard-submit.js";
import { listenForKeys } from "./controls.js";
import { messages } from "./i18n.js";
import { createLanguagePicker } from "./picker.js";
import { createResultPanel } from "./result.js";
import { ROUND_MS, createRound, moveShip, moveShipTo, shoot } from "./state.js";
import { createRoundView } from "./view.js";

/** @typedef {import("../../core/registry.js").GameContext} GameContext */
/** @typedef {import("./colors.js").TargetLanguage} TargetLanguage */
/** @typedef {import("./state.js").RoundState} RoundState */
/** @typedef {import("./controls.js").Command} Command */
/** @typedef {Command | {to: number}} Action Recorded for the Worker's replay (R8.6). */
/** @typedef {import("../../core/online/server-run.js").ServerRun} ServerRun */

const CLOCK_REFRESH_MS = 100;

/** Remembered until the page is reloaded (R9.1). */
/** @type {TargetLanguage | null} */
let lastLanguage = null;

/** @type {import("../../core/registry.js").GameDefinition} */
export const colorInvasion = {
  id: "color-invasion",
  titleKey: "colorInvasion.title",
  icon: "👾",
  messages,
  mount(root, ctx) {
    loadStylesheet(new URL("./style.css", import.meta.url).href);
    let stopRound = () => {};
    /** @param {TargetLanguage} lang */
    const play = (lang) => {
      lastLanguage = lang;
      stopRound();
      stopRound = _startRound(root, ctx, lang, () => play(lang));
    };
    root.replaceChildren(createLanguagePicker(ctx.t, lastLanguage, play));
    return () => stopRound();
  },
};

/**
 * Gets a server-checked run for a registered player, then plays the round; returns a cleanup
 * function.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {TargetLanguage} lang
 * @param {() => void} playAgain
 */
function _startRound(root, ctx, lang, playAgain) {
  let cancelled = false;
  let stopRound = () => {};
  root.replaceChildren(h("p", { class: "ci-preparing" }, ctx.t("colorInvasion.preparing")));
  startServerRun(ctx.player.account, "/color-runs", { lang }).then((run) => {
    if (!cancelled) stopRound = _playRound(root, ctx, { lang, run }, playAgain);
  });
  return () => {
    cancelled = true;
    stopRound();
  };
}

/**
 * Plays one 60 s round; returns a cleanup function.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {{lang: TargetLanguage, run: ServerRun | null}} round
 * @param {() => void} playAgain
 */
function _playRound(root, ctx, { lang, run }, playAgain) {
  const { t } = ctx;
  const rng = run === null ? Math.random : createRng(run.seed);
  let state = createRound(rng);
  /** Every command, replayed by the Worker to check the score. */
  /** @type {Action[]} */
  const actions = [];
  log.debug("color invasion round", lang, state.columns.map((c) => c.color).join());
  const timer = createTimer();
  const view = createRoundView(root, {
    t,
    lang,
    columnCount: state.columns.length,
    onCommand: runCommand,
    onColumnTap: (column) => {
      actions.push({ to: column });
      apply(moveShipTo(state, column));
    },
  });
  timer.start();
  apply(state);
  const ticker = setInterval(tick, CLOCK_REFRESH_MS);
  const stopKeys = listenForKeys(runCommand);

  function tick() {
    const remainingMs = Math.max(0, ROUND_MS - timer.elapsedMs());
    view.showTime(remainingMs);
    if (remainingMs === 0) finish();
  }

  /** @param {Command} command */
  function runCommand(command) {
    actions.push(command);
    if (command !== "shoot") return apply(moveShip(state, command));
    const column = state.shipColumn;
    const shot = shoot(state, rng);
    log.debug("shot", shot.outcome, "score", shot.state.score);
    const points = shot.state.score - state.score;
    apply(shot.state);
    view.showShot(shot.outcome, column, points);
  }

  /** @param {RoundState} next */
  function apply(next) {
    state = next;
    view.show(state);
    tick();
  }

  function finish() {
    stop();
    log.info(`color invasion (${lang}) finished with ${state.score} points`);
    view.showResult(
      createResultPanel(
        t,
        state,
        { onPlayAgain: playAgain, onHome: ctx.exit },
        run === null
          ? null
          : submitToLeaderboard(t, async () => {
              await finishServerRun(run, actions);
              return null;
            }),
      ),
    );
  }

  function stop() {
    clearInterval(ticker);
    stopKeys();
  }

  return stop;
}
