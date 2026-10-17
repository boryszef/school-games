import { log } from "../../core/log.js";
import { createTimer } from "../../core/timer.js";
import { h, loadStylesheet } from "../../core/ui/dom.js";
import { createBoard } from "./board.js";
import { COLOR_NAMES } from "./colors.js";
import { messages } from "./i18n.js";
import { createLanguagePicker } from "./picker.js";
import { createResultPanel } from "./result.js";
import { ROUND_MS, createRound, moveShip, moveShipTo, shoot } from "./state.js";

/** @typedef {import("../../core/registry.js").GameContext} GameContext */
/** @typedef {import("./colors.js").TargetLanguage} TargetLanguage */
/** @typedef {import("./state.js").RoundState} RoundState */
/** @typedef {"left" | "right" | "shoot"} Command */

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
      stopRound = _playRound(root, ctx, lang, () => play(lang));
    };
    root.replaceChildren(createLanguagePicker(ctx.t, lastLanguage, play));
    return () => stopRound();
  },
};

/**
 * Plays one 60 s round; returns a cleanup function.
 * @param {HTMLElement} root
 * @param {GameContext} ctx
 * @param {TargetLanguage} lang
 * @param {() => void} playAgain
 */
function _playRound(root, ctx, lang, playAgain) {
  const { t } = ctx;
  let state = createRound(Math.random);
  log.debug("color invasion round", lang, state.columns.map((c) => c.color).join());
  const timer = createTimer();
  const word = h("p", { class: "ci-word" });
  const score = h("span", { class: "ci-score" });
  const clock = h("span", { class: "ci-clock" });
  const board = createBoard(state.columns.length, (column) => apply(moveShipTo(state, column)));
  const stage = h("div", { class: "ci-stage" }, board.element);

  root.replaceChildren(
    h(
      "div",
      { class: "ci" },
      h("p", { class: "ci-goal" }, t("colorInvasion.goal")),
      h("p", { class: "ci-hud" }, clock, score),
      h("p", { class: "ci-prompt" }, t("colorInvasion.shootThis")),
      word,
      stage,
      _createControls(t, run),
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
    run(command);
  }

  /** @param {Command} command */
  function run(command) {
    if (command !== "shoot") return apply(moveShip(state, command));
    const column = state.shipColumn;
    const shot = shoot(state, Math.random);
    log.debug("shot", shot.outcome, "score", shot.state.score);
    apply(shot.state);
    board.flash(shot.outcome, column);
  }

  /** @param {RoundState} next */
  function apply(next) {
    state = next;
    render();
  }

  function render() {
    word.textContent = COLOR_NAMES[lang][state.target];
    score.textContent = t("colorInvasion.score", { score: state.score });
    board.update(state);
    tick();
  }

  function finish() {
    stop();
    log.info(`color invasion (${lang}) finished with ${state.score} points`);
    stage.append(createResultPanel(t, state, { onPlayAgain: playAgain, onHome: ctx.exit }));
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
