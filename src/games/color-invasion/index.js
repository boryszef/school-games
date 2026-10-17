import { log } from "../../core/log.js";
import { finishServerRun, startServerRun } from "../../core/online/server-run.js";
import { createRng } from "../../core/random.js";
import { createTimer } from "../../core/timer.js";
import { h, loadStylesheet } from "../../core/ui/dom.js";
import { submitToLeaderboard } from "../../core/ui/leaderboard-submit.js";
import { createBoard } from "./board.js";
import { COLOR_NAMES } from "./colors.js";
import { messages } from "./i18n.js";
import { createLanguagePicker } from "./picker.js";
import { createResultPanel } from "./result.js";
import { createScoreDisplay } from "./score.js";
import { ROUND_MS, createRound, moveShip, moveShipTo, shoot } from "./state.js";

/** @typedef {import("../../core/registry.js").GameContext} GameContext */
/** @typedef {import("./colors.js").TargetLanguage} TargetLanguage */
/** @typedef {import("./state.js").RoundState} RoundState */
/** @typedef {"left" | "right" | "shoot"} Command */
/** @typedef {Command | {to: number}} Action Recorded for the Worker's replay (R8.6). */
/** @typedef {import("../../core/online/server-run.js").ServerRun} ServerRun */

const CLOCK_REFRESH_MS = 100;

/** @type {Record<string, Command>} */
const KEY_COMMANDS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  a: "left",
  d: "right",
  " ": "shoot",
};

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
  const word = h("p", { class: "ci-word" });
  const score = createScoreDisplay(t);
  const clock = h("span", { class: "ci-clock" });
  const board = createBoard(state.columns.length, (column) => {
    actions.push({ to: column });
    apply(moveShipTo(state, column));
  });
  const stage = h("div", { class: "ci-stage" }, board.element);

  root.replaceChildren(
    h(
      "div",
      { class: "ci" },
      h("p", { class: "ci-goal" }, t("colorInvasion.goal")),
      h("p", { class: "ci-hud" }, clock),
      score.element,
      h("p", { class: "ci-prompt" }, t("colorInvasion.shootThis")),
      word,
      stage,
      _createControls(t, runCommand),
    ),
  );
  timer.start();
  render();
  const ticker = setInterval(tick, CLOCK_REFRESH_MS);
  window.addEventListener("keydown", onKey);

  function remainingMs() {
    return Math.max(0, ROUND_MS - timer.elapsedMs());
  }

  function tick() {
    clock.textContent = t("colorInvasion.timeLeft", { seconds: Math.ceil(remainingMs() / 1000) });
    if (remainingMs() === 0) finish();
  }

  /** @param {KeyboardEvent} event */
  function onKey(event) {
    const command = KEY_COMMANDS[event.key];
    if (command === undefined) return;
    event.preventDefault();
    runCommand(command);
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
    board.flash(shot.outcome, column);
    score.react(shot.outcome, points);
  }

  /** @param {RoundState} next */
  function apply(next) {
    state = next;
    render();
  }

  function render() {
    word.textContent = COLOR_NAMES[lang][state.target];
    score.show(state.score);
    board.update(state);
    tick();
  }

  function finish() {
    stop();
    log.info(`color invasion (${lang}) finished with ${state.score} points`);
    stage.append(
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
    window.removeEventListener("keydown", onKey);
  }

  return stop;
}

/**
 * On-screen ◀ 🔥 ▶ buttons. They don't take focus, so Space never also presses one.
 * @param {import("../../core/i18n.js").Translate} t
 * @param {(command: Command) => void} onCommand
 */
function _createControls(t, onCommand) {
  /** @type {[Command, string, string][]} */
  const buttons = [
    ["left", "◀", t("dpad.left")],
    ["shoot", "🔥", t("colorInvasion.shoot")],
    ["right", "▶", t("dpad.right")],
  ];
  return h(
    "div",
    { class: "ci-controls" },
    ...buttons.map(([command, label, name]) =>
      h(
        "button",
        {
          type: "button",
          class: `ci-control ci-${command}`,
          "aria-label": name,
          onmousedown: (event) => event.preventDefault(),
          onclick: () => onCommand(command),
        },
        label,
      ),
    ),
  );
}
